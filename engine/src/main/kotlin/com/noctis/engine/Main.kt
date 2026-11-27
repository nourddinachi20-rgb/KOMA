package com.noctis.engine

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import org.koitharu.kotatsu.parsers.model.MangaParserSource
import org.koitharu.kotatsu.parsers.model.SortOrder
import org.koitharu.kotatsu.parsers.util.await
import kotlinx.coroutines.delay
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

private val ALLOWED_LOCALES = setOf("en", "fr", "ar", "")
private val verifiedCacheFile = File(System.getProperty("user.home"), ".koma-verified-sources.json")
private val verifiedSources: MutableSet<String> = ConcurrentHashMap.newKeySet()
private val imageWriteCounter = AtomicInteger(0)
private const val MAX_IMAGE_CACHE_BYTES = 1536L * 1024L * 1024L // 1.5 GB LRU cap
private val imageHostSemaphores = ConcurrentHashMap<String, Semaphore>()

private fun semaphoreForHost(url: String): Semaphore {
    val host = runCatching { java.net.URI(url).host?.lowercase() }.getOrNull() ?: "default"
    return imageHostSemaphores.computeIfAbsent(host) { Semaphore(5) }
}

private suspend fun fetchImageBytesWithRetry(
    targetUrl: String,
    srcParam: String?,
    source: MangaParserSource?,
): Triple<Int, String, ByteArray> {
    val sem = semaphoreForHost(targetUrl)
    return sem.withPermit {
        var lastCode = 502
        var attempt = 0
        while (attempt < 3) {
            val result = runCatching {
                val resp = if (CustomSourceRegistry.isCustom(srcParam)) {
                    val req = okhttp3.Request.Builder()
                        .get()
                        .url(targetUrl)
                        .header("User-Agent", org.koitharu.kotatsu.parsers.network.UserAgents.CHROME_DESKTOP)
                        .header("Referer", "https://mangaball.com/")
                        .build()
                    NoctisMangaLoaderContext.httpClient.newCall(req).await()
                } else {
                    NoctisMangaLoaderContext.fetchRaw(targetUrl, source)
                }
                resp.use { r ->
                    if (r.isSuccessful) {
                        Triple(r.code, r.header("Content-Type") ?: "image/jpeg", r.body?.bytes() ?: ByteArray(0))
                    } else {
                        lastCode = r.code
                        null
                    }
                }
            }.getOrNull()

            if (result != null) return@withPermit result
            if (lastCode !in setOf(429, 502, 503, 504) && attempt > 0) break
            attempt++
            if (attempt < 3) delay(550L * attempt)
        }
        Triple(lastCode, "text/plain", ByteArray(0))
    }
}

private fun pruneImageCacheIfNeeded() {
    val dir = NoctisMangaLoaderContext.imageCacheDir
    val files = dir.listFiles()?.filter { it.isFile && it.name.endsWith(".bin") } ?: return
    var total = files.sumOf { it.length() }
    if (total <= MAX_IMAGE_CACHE_BYTES) return
    val sorted = files.sortedBy { it.lastModified() }
    for (f in sorted) {
        if (total <= (MAX_IMAGE_CACHE_BYTES * 0.85).toLong()) break
        val len = f.length()
        if (f.delete()) {
            File(dir, f.nameWithoutExtension + ".meta").delete()
            total -= len
        }
    }
}

private fun loadInitialVerifiedSources() {
    val raw = if (verifiedCacheFile.exists()) {
        runCatching { verifiedCacheFile.readText() }.getOrNull()
    } else {
        object {}.javaClass.getResourceAsStream("/verified-sources.json")?.bufferedReader()?.use { it.readText() }
    }
    if (!raw.isNullOrBlank()) {
        runCatching {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val name = obj.optString("name", "")
                if (name.isNotBlank()) verifiedSources.add(name)
            }
        }
    }
    // Ensure top curated & custom sources are always registered if reachable
    verifiedSources.addAll(CustomSourceRegistry.defs.keys)
    verifiedSources.add("ASURASCANS")
}

private fun saveVerifiedSources(items: List<JSONObject>) {
    runCatching {
        verifiedCacheFile.writeText(JSONArray(items).toString(2))
    }
}

fun main(args: Array<String>) {
    val port = args.firstOrNull()?.toIntOrNull()
        ?: System.getenv("NOCTIS_ENGINE_PORT")?.toIntOrNull()
        ?: 47832

    loadInitialVerifiedSources()
    println("KOMA Engine starting on 127.0.0.1:$port (${verifiedSources.size} verified EN/FR/AR/multi sources)...")

    // Delay parser pre-warming slightly so /health responds immediately on startup
    CoroutineScope(SupervisorJob() + Dispatchers.Default).launch {
        delay(2_500L)
        for (name in listOf("MANGADEX", "ASURASCANS", "WEEBCENTRAL", "MANGAPILL", "MANGAREAD", "LELMANGA", "TEAMXNOVEL")) {
            resolveSource(name)?.let { runCatching { NoctisMangaLoaderContext.getParser(it) } }
        }
    }

    embeddedServer(CIO, host = "127.0.0.1", port = port) {
        install(CORS) {
            anyHost()
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowMethod(HttpMethod.Options)
            allowHeader(HttpHeaders.ContentType)
        }
        install(StatusPages) {
            exception<Throwable> { call, cause ->
                cause.printStackTrace()
                val err = JSONObject().apply {
                    put("error", cause.message ?: cause::class.simpleName ?: "Unknown error")
                    put("type", cause::class.simpleName ?: "Error")
                    if (cause is org.jsoup.HttpStatusException && (cause.statusCode == 403 || cause.statusCode == 503)) {
                        put("code", "CLOUDFLARE_REQUIRED")
                        put("statusCode", cause.statusCode)
                        put("challengeUrl", cause.url)
                    }
                }
                call.respondText(err.toString(), ContentType.Application.Json, HttpStatusCode.InternalServerError)
            }
        }

        routing {
            get("/health") {
                val res = JSONObject().apply {
                    put("status", "ok")
                    put("sourcesCount", verifiedSources.size)
                }
                call.respondText(res.toString(), ContentType.Application.Json)
            }

            get("/api/sources") {
                val includeUnverified = call.request.queryParameters["includeUnverified"] == "true"
                val arr = JSONArray()

                // 1. Custom 2026 sources (MangaBall EN/FR/AR/All)
                for (def in CustomSourceRegistry.defs.values) {
                    if (def.locale !in ALLOWED_LOCALES) continue
                    arr.put(CustomSourceRegistry.sourceToJson(def))
                }

                // 2. Bundled Kotatsu sources filtered strictly to EN / FR / AR / Multi & verified working
                for (src in MangaParserSource.entries) {
                    if (src.locale !in ALLOWED_LOCALES) continue
                    if (!includeUnverified && src.name !in verifiedSources) continue
                    val parser = runCatching { NoctisMangaLoaderContext.getParser(src) }.getOrNull()
                    val obj = JsonMappers.sourceToJson(src, parser)
                    obj.put("verified", src.name in verifiedSources)
                    arr.put(obj)
                }
                val res = JSONObject().apply {
                    put("sources", arr)
                    put("total", arr.length())
                }
                call.respondText(res.toString(), ContentType.Application.Json)
            }

            post("/api/sources/cookies") {
                val body = JSONObject(call.receiveText())
                val host = body.optString("host", "").trim()
                val userAgent = body.optString("userAgent", "").takeIf { it.isNotBlank() }
                val cookiesArr = body.optJSONArray("cookies") ?: JSONArray()
                val list = mutableListOf<okhttp3.Cookie>()
                for (i in 0 until cookiesArr.length()) {
                    val c = cookiesArr.optJSONObject(i) ?: continue
                    val name = c.optString("name", "")
                    val value = c.optString("value", "")
                    val domain = c.optString("domain", host).trimStart('.')
                    if (name.isBlank() || domain.isBlank()) continue
                    val builder = okhttp3.Cookie.Builder()
                        .name(name)
                        .value(value)
                        .domain(domain)
                        .path(c.optString("path", "/"))
                    if (c.optBoolean("secure", false)) builder.secure()
                    if (c.optBoolean("httpOnly", false)) builder.httpOnly()
                    val exp = c.optLong("expiresAt", System.currentTimeMillis() + 86_400_000L * 7)
                    builder.expiresAt(exp)
                    runCatching { list.add(builder.build()) }
                }
                if (host.isNotBlank()) {
                    NoctisMangaLoaderContext.setHostCookies(host, list, userAgent)
                }
                call.respondText(
                    JSONObject().put("injected", list.size).toString(),
                    ContentType.Application.Json,
                )
            }

            post("/api/sources/verify") {
                val sem = Semaphore(24)
                val candidates = MangaParserSource.entries.filter { it.locale in ALLOWED_LOCALES }
                val working = coroutineScope {
                    candidates.map { src ->
                        async(Dispatchers.IO) {
                            sem.withPermit {
                                withTimeoutOrNull(8_500L) {
                                    runCatching {
                                        val parser = NoctisMangaLoaderContext.getParser(src)
                                        val order = if (SortOrder.POPULARITY in parser.availableSortOrders) {
                                            SortOrder.POPULARITY
                                        } else {
                                            parser.availableSortOrders.first()
                                        }
                                        val list = parser.getList(
                                            0,
                                            order,
                                            org.koitharu.kotatsu.parsers.model.MangaListFilter.EMPTY,
                                        )
                                        val valid = list.filter { it.title.isNotBlank() && !it.coverUrl.isNullOrBlank() }
                                        if (valid.isNotEmpty()) {
                                            JSONObject().apply {
                                                put("name", src.name)
                                                put("title", src.title)
                                                put("locale", src.locale.ifEmpty { "multi" })
                                                put("count", valid.size)
                                            }
                                        } else {
                                            null
                                        }
                                    }.getOrNull()
                                }
                            }
                        }
                    }.awaitAll().filterNotNull()
                }
                verifiedSources.clear()
                verifiedSources.addAll(CustomSourceRegistry.defs.keys)
                for (w in working) {
                    verifiedSources.add(w.getString("name"))
                }
                saveVerifiedSources(working)
                call.respondText(
                    JSONObject().apply {
                        put("verifiedCount", verifiedSources.size)
                    }.toString(),
                    ContentType.Application.Json,
                )
            }

            get("/api/sources/{source}/filters") {
                val sourceName = call.parameters["source"]
                CustomSourceRegistry.defs[sourceName]?.let { def ->
                    call.respondText(
                        CustomSourceRegistry.filterMetadataToJson(def).toString(),
                        ContentType.Application.Json,
                    )
                    return@get
                }
                val source = resolveSource(sourceName)
                    ?: return@get call.respondText(
                        JSONObject().put("error", "Unknown source").toString(),
                        ContentType.Application.Json,
                        HttpStatusCode.NotFound,
                    )
                val parser = NoctisMangaLoaderContext.getParser(source)
                val options = parser.getFilterOptions()
                call.respondText(
                    JsonMappers.filterMetadataToJson(parser, options).toString(),
                    ContentType.Application.Json,
                )
            }

            post("/api/sources/{source}/domain") {
                val source = resolveSource(call.parameters["source"])
                    ?: return@post call.respondText(
                        JSONObject().put("error", "Unknown source").toString(),
                        ContentType.Application.Json,
                        HttpStatusCode.NotFound,
                    )
                val body = JSONObject(call.receiveText())
                val domain = body.optString("domain", "")
                NoctisMangaLoaderContext.setDomainOverride(source.name, domain)
                val parser = NoctisMangaLoaderContext.getParser(source)
                call.respondText(
                    JSONObject().put("domain", parser.domain).toString(),
                    ContentType.Application.Json,
                )
            }

            post("/api/sources/{source}/list") {
                val sourceName = call.parameters["source"]
                val body = JSONObject(call.receiveText().ifBlank { "{}" })
                val offset = body.optInt("offset", 0)
                val orderStr = body.optString("order", "").takeIf { it.isNotBlank() }

                CustomSourceRegistry.defs[sourceName]?.let { def ->
                    val query = body.optJSONObject("filter")?.optString("query", "")?.takeIf { it.isNotBlank() }
                    val showNsfw = body.optBoolean("showNsfw", false)
                    val arr = CustomSourceRegistry.getList(def, offset, orderStr, query, showNsfw)
                    call.respondText(JSONObject().put("items", arr).toString(), ContentType.Application.Json)
                    return@post
                }

                val source = resolveSource(sourceName)
                    ?: return@post call.respondText(
                        JSONObject().put("error", "Unknown source").toString(),
                        ContentType.Application.Json,
                        HttpStatusCode.NotFound,
                    )
                val parser = NoctisMangaLoaderContext.getParser(source)
                val requestedOrder = orderStr?.let { runCatching { SortOrder.valueOf(it) }.getOrNull() }
                val order = if (requestedOrder != null && requestedOrder in parser.availableSortOrders) {
                    requestedOrder
                } else {
                    parser.availableSortOrders.first()
                }
                val filter = JsonMappers.jsonToFilter(body.optJSONObject("filter"), source)
                val list = parser.getList(offset, order, filter)
                val arr = JSONArray()
                for (m in list) arr.put(JsonMappers.mangaToJson(m))
                call.respondText(
                    JSONObject().put("items", arr).toString(),
                    ContentType.Application.Json,
                )
            }

            post("/api/sources/{source}/details") {
                val sourceName = call.parameters["source"]
                val body = JSONObject(call.receiveText())
                val mangaObj = body.getJSONObject("manga")

                CustomSourceRegistry.defs[sourceName]?.let { def ->
                    val detailed = CustomSourceRegistry.getDetails(def, mangaObj)
                    call.respondText(
                        JSONObject().put("manga", detailed).toString(),
                        ContentType.Application.Json,
                    )
                    return@post
                }

                val source = resolveSource(sourceName)
                    ?: return@post call.respondText(
                        JSONObject().put("error", "Unknown source").toString(),
                        ContentType.Application.Json,
                        HttpStatusCode.NotFound,
                    )
                val manga = JsonMappers.jsonToManga(mangaObj, source)
                val parser = NoctisMangaLoaderContext.getParser(source)
                val detailed = parser.getDetails(manga)
                call.respondText(
                    JSONObject().put("manga", JsonMappers.mangaToJson(detailed)).toString(),
                    ContentType.Application.Json,
                )
            }

            post("/api/sources/{source}/pages") {
                val sourceName = call.parameters["source"]
                val body = JSONObject(call.receiveText())
                val chapterObj = body.getJSONObject("chapter")

                CustomSourceRegistry.defs[sourceName]?.let { def ->
                    val arr = CustomSourceRegistry.getPages(def, chapterObj)
                    call.respondText(JSONObject().put("pages", arr).toString(), ContentType.Application.Json)
                    return@post
                }

                val source = resolveSource(sourceName)
                    ?: return@post call.respondText(
                        JSONObject().put("error", "Unknown source").toString(),
                        ContentType.Application.Json,
                        HttpStatusCode.NotFound,
                    )
                val chapter = JsonMappers.jsonToChapter(chapterObj, source)
                val parser = NoctisMangaLoaderContext.getParser(source)
                val pages = parser.getPages(chapter)
                val arr = JSONArray()
                for (p in pages) {
                    val resolvedUrl = if (p.url.startsWith("http://") || p.url.startsWith("https://")) {
                        p.url
                    } else {
                        runCatching { parser.getPageUrl(p) }.getOrDefault(p.url)
                    }
                    val pageJson = JsonMappers.pageToJson(p)
                    pageJson.put("resolvedUrl", resolvedUrl)
                    arr.put(pageJson)
                }
                call.respondText(
                    JSONObject().put("pages", arr).toString(),
                    ContentType.Application.Json,
                )
            }

            post("/api/sources/{source}/page-url") {
                val source = resolveSource(call.parameters["source"])
                    ?: return@post call.respondText(
                        JSONObject().put("error", "Unknown source").toString(),
                        ContentType.Application.Json,
                        HttpStatusCode.NotFound,
                    )
                val body = JSONObject(call.receiveText())
                val page = JsonMappers.jsonToPage(body.getJSONObject("page"), source)
                val parser = NoctisMangaLoaderContext.getParser(source)
                val url = parser.getPageUrl(page)
                call.respondText(
                    JSONObject().put("url", url).toString(),
                    ContentType.Application.Json,
                )
            }

            post("/api/search-all") {
                val body = JSONObject(call.receiveText())
                val query = body.optString("query", "").trim()
                val sourceNames = mutableListOf<String>()
                body.optJSONArray("sources")?.let { arr ->
                    for (i in 0 until arr.length()) {
                        arr.optString(i, "").takeIf { it.isNotBlank() }?.let { sourceNames.add(it) }
                    }
                }
                val targets = sourceNames.distinct().take(12)
                val results = coroutineScope {
                    targets.map { name ->
                        async {
                            withTimeoutOrNull(12_000L) {
                                runCatching {
                                    CustomSourceRegistry.defs[name]?.let { def ->
                                        val items = CustomSourceRegistry.getList(def, 0, "RELEVANCE", query)
                                        val sliced = JSONArray()
                                        for (i in 0 until minOf(12, items.length())) sliced.put(items.get(i))
                                        return@runCatching JSONObject().apply {
                                            put("source", def.name)
                                            put("sourceTitle", def.title)
                                            put("items", sliced)
                                        }
                                    }
                                    val src = resolveSource(name) ?: return@runCatching null
                                    val parser = NoctisMangaLoaderContext.getParser(src)
                                    val order = if (SortOrder.POPULARITY in parser.availableSortOrders) {
                                        SortOrder.POPULARITY
                                    } else {
                                        parser.availableSortOrders.first()
                                    }
                                    val filter = org.koitharu.kotatsu.parsers.model.MangaListFilter(query = query)
                                    val items = parser.getList(0, order, filter).take(12)
                                    JSONObject().apply {
                                        put("source", src.name)
                                        put("sourceTitle", src.title)
                                        put("items", JSONArray(items.map { JsonMappers.mangaToJson(it) }))
                                    }
                                }.getOrNull()
                            }
                        }
                    }.awaitAll().filterNotNull()
                }
                call.respondText(
                    JSONObject().put("results", JSONArray(results)).toString(),
                    ContentType.Application.Json,
                )
            }

            get("/api/image") {
                val targetUrl = call.request.queryParameters["url"]
                    ?: return@get call.respond(HttpStatusCode.BadRequest, "Missing url")
                val srcParam = call.request.queryParameters["source"]

                // Fast local SSD disk cache hit
                val cacheKey = sha256("${srcParam.orEmpty()}|$targetUrl")
                val imgFile = File(NoctisMangaLoaderContext.imageCacheDir, "$cacheKey.bin")
                val metaFile = File(NoctisMangaLoaderContext.imageCacheDir, "$cacheKey.meta")
                if (imgFile.exists() && imgFile.length() > 0L) {
                    imgFile.setLastModified(System.currentTimeMillis())
                    val mime = if (metaFile.exists()) runCatching { metaFile.readText().trim() }.getOrDefault("image/jpeg") else "image/jpeg"
                    val contentType = runCatching { ContentType.parse(mime) }.getOrDefault(ContentType.Image.JPEG)
                    call.response.header(HttpHeaders.CacheControl, "public, max-age=2592000, immutable")
                    call.respondBytes(imgFile.readBytes(), contentType)
                    return@get
                }

                val source = resolveSource(srcParam)
                val (statusCode, contentTypeStr, bytes) = fetchImageBytesWithRetry(targetUrl, srcParam, source)
                if (statusCode !in 200..299 || bytes.isEmpty()) {
                    call.respond(HttpStatusCode.fromValue(if (statusCode in 400..599) statusCode else 502), "Upstream error $statusCode")
                    return@get
                }
                if (bytes.size < 18 * 1024 * 1024) {
                    runCatching {
                        imgFile.writeBytes(bytes)
                        metaFile.writeText(contentTypeStr)
                        if (imageWriteCounter.incrementAndGet() % 60 == 0) {
                            CoroutineScope(Dispatchers.IO).launch { pruneImageCacheIfNeeded() }
                        }
                    }
                }
                val contentType = runCatching { ContentType.parse(contentTypeStr) }
                    .getOrDefault(ContentType.Image.JPEG)
                call.response.header(HttpHeaders.CacheControl, "public, max-age=2592000, immutable")
                call.respondBytes(bytes, contentType)
            }
            get("/api/cache/stats") {
                val files = NoctisMangaLoaderContext.imageCacheDir.listFiles()?.filter { it.isFile } ?: emptyList()
                val totalBytes = files.sumOf { it.length() }
                val binCount = files.count { it.name.endsWith(".bin") }
                call.respondText(
                    JSONObject().apply {
                        put("files", binCount)
                        put("bytes", totalBytes)
                    }.toString(),
                    ContentType.Application.Json,
                )
            }

            post("/api/cache/clear") {
                val files = NoctisMangaLoaderContext.imageCacheDir.listFiles() ?: emptyArray()
                var deleted = 0
                for (f in files) {
                    if (f.isFile && f.delete()) deleted++
                }
                call.respondText(
                    JSONObject().put("deleted", deleted).toString(),
                    ContentType.Application.Json,
                )
            }
        }
    }.start(wait = true)
}

private fun sha256(input: String): String {
    val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
    return bytes.joinToString("") { "%02x".format(it) }
}

private fun resolveSource(name: String?): MangaParserSource? {
    if (name.isNullOrBlank()) return null
    return runCatching { MangaParserSource.valueOf(name) }.getOrNull()
}

package com.noctis.engine

import android.graphics.BitmapFactory
import android.graphics.Canvas
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.koitharu.kotatsu.parsers.MangaLoaderContext
import org.koitharu.kotatsu.parsers.MangaParser
import org.koitharu.kotatsu.parsers.bitmap.Bitmap
import org.koitharu.kotatsu.parsers.bitmap.Rect
import org.koitharu.kotatsu.parsers.config.ConfigKey
import org.koitharu.kotatsu.parsers.config.MangaSourceConfig
import org.koitharu.kotatsu.parsers.model.MangaParserSource
import org.koitharu.kotatsu.parsers.model.MangaSource
import org.koitharu.kotatsu.parsers.network.UserAgents
import org.koitharu.kotatsu.parsers.util.await
import org.mozilla.javascript.Context
import org.mozilla.javascript.ScriptableObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

class AndroidBitmap(val bitmap: android.graphics.Bitmap) : Bitmap {
    override val width: Int get() = bitmap.width
    override val height: Int get() = bitmap.height

    override fun drawBitmap(sourceBitmap: Bitmap, src: Rect, dst: Rect) {
        val canvas = Canvas(bitmap)
        val srcRect = android.graphics.Rect(src.left, src.top, src.left + src.width, src.top + src.height)
        val dstRect = android.graphics.Rect(dst.left, dst.top, dst.left + dst.width, dst.top + dst.height)
        canvas.drawBitmap((sourceBitmap as AndroidBitmap).bitmap, srcRect, dstRect, null)
    }

    fun compressPng(): ByteArray = ByteArrayOutputStream().use { baos ->
        bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, baos)
        baos.toByteArray()
    }
}

class ThreadSafeCookieJar : CookieJar {
    private data class Key(val host: String, val name: String)
    private val store = ConcurrentHashMap<Key, Cookie>()

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val now = System.currentTimeMillis()
        return store.values.filter { it.expiresAt >= now && it.matches(url) }
    }

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        cookies.forEach { cookie ->
            store[Key(url.host, cookie.name)] = cookie
        }
    }

    fun injectCookies(host: String, cookies: List<Cookie>) {
        val cleanHost = host.lowercase().removePrefix("www.")
        cookies.forEach { cookie ->
            store[Key(cleanHost, cookie.name)] = cookie
            store[Key(host.lowercase(), cookie.name)] = cookie
        }
    }
}

object NoctisMangaLoaderContext : MangaLoaderContext() {
    private val parserCache = ConcurrentHashMap<MangaParserSource, MangaParser>()
    private val domainOverrides = ConcurrentHashMap<String, String>()
    private val hostUserAgents = ConcurrentHashMap<String, String>()

    @Volatile
    private var cacheRoot: File = File(System.getProperty("java.io.tmpdir", "/data/local/tmp"), ".koma-cache")

    val imageCacheDir: File
        get() = File(cacheRoot, "images").apply { mkdirs() }

    private val httpCacheDir: File
        get() = File(cacheRoot, "http").apply { mkdirs() }

    fun init(androidCacheDir: File) {
        cacheRoot = File(androidCacheDir, "koma-cache").apply { mkdirs() }
        imageCacheDir.mkdirs()
        httpCacheDir.mkdirs()
    }

    override val cookieJar: ThreadSafeCookieJar = ThreadSafeCookieJar()

    fun setHostCookies(host: String, cookies: List<Cookie>, userAgent: String?) {
        cookieJar.injectCookies(host, cookies)
        if (!userAgent.isNullOrBlank()) {
            val clean = host.lowercase().removePrefix("www.")
            hostUserAgents[clean] = userAgent
            hostUserAgents[host.lowercase()] = userAgent
        }
    }

    override val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .cache(Cache(httpCacheDir, 128L * 1024L * 1024L))
            .connectionPool(ConnectionPool(16, 5, TimeUnit.MINUTES))
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(35, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .addInterceptor(ParserHeadersInterceptor())
            .build()
    }

    fun getParser(source: MangaParserSource): MangaParser =
        parserCache.computeIfAbsent(source) { newParserInstance(it) }

    fun setDomainOverride(sourceName: String, domain: String?) {
        if (domain.isNullOrBlank()) {
            domainOverrides.remove(sourceName)
        } else {
            domainOverrides[sourceName] = domain.trim()
        }
    }

    @Deprecated("Provide a base url")
    override suspend fun evaluateJs(script: String): String? = evaluateJs("", script)

    override suspend fun evaluateJs(baseUrl: String, script: String): String? {
        val cx = Context.enter()
        return try {
            cx.optimizationLevel = -1
            cx.languageVersion = Context.VERSION_ES6
            val scope: ScriptableObject = cx.initStandardObjects()
            val result = cx.evaluateString(scope, script, baseUrl.ifEmpty { "koma-js" }, 1, null)
            if (result == null || result == Context.getUndefinedValue()) null else Context.toString(result)
        } finally {
            Context.exit()
        }
    }

    override fun getConfig(source: MangaSource): MangaSourceConfig = object : MangaSourceConfig {
        @Suppress("UNCHECKED_CAST")
        override fun <T> get(key: ConfigKey<T>): T {
            if (key is ConfigKey.Domain) {
                val override = domainOverrides[source.name]
                if (!override.isNullOrBlank()) return override as T
            }
            if (key is ConfigKey.UserAgent && source == MangaParserSource.MANGADEX) {
                return UserAgents.KOTATSU as T
            }
            return key.defaultValue
        }
    }

    override fun getDefaultUserAgent(): String = UserAgents.CHROME_DESKTOP

    override fun redrawImageResponse(response: Response, redraw: (Bitmap) -> Bitmap): Response {
        val body = response.body ?: return response
        val srcBitmap = body.byteStream().use(BitmapFactory::decodeStream)
            ?: error("Failed to decode image for redraw")
        val redrawn = redraw(AndroidBitmap(srcBitmap)) as AndroidBitmap
        val pngBytes = redrawn.compressPng()
        return response.newBuilder()
            .body(pngBytes.toResponseBody("image/png".toMediaTypeOrNull()))
            .build()
    }

    override fun createBitmap(width: Int, height: Int): Bitmap =
        AndroidBitmap(android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888))

    suspend fun fetchRaw(url: String, source: MangaParserSource?): Response {
        val reqBuilder = Request.Builder().get().url(url)
        if (source != null) {
            reqBuilder.tag(MangaSource::class.java, source)
        }
        return httpClient.newCall(reqBuilder.build()).await()
    }

    private class ParserHeadersInterceptor : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val request = chain.request()
            val source = request.tag(MangaSource::class.java) as? MangaParserSource
            val parser = source?.let { getParser(it) }
            val headersBuilder = request.headers.newBuilder()
            val host = request.url.host.lowercase()
            val cfUa = hostUserAgents[host] ?: hostUserAgents[host.removePrefix("www.")]
            if (!cfUa.isNullOrBlank() && source != MangaParserSource.MANGADEX) {
                headersBuilder["User-Agent"] = cfUa
            }
            if (headersBuilder["Referer"] == null && parser != null && source != MangaParserSource.MANGADEX) {
                headersBuilder["Referer"] = "https://${parser.domain}/"
            }
            val newRequest = request.newBuilder().headers(headersBuilder.build()).build()
            return if (parser != null) {
                parser.intercept(ProxyChain(chain, newRequest))
            } else {
                val fallback = if (newRequest.header("User-Agent") == null) {
                    newRequest.newBuilder().header("User-Agent", UserAgents.CHROME_DESKTOP).build()
                } else {
                    newRequest
                }
                chain.proceed(fallback)
            }
        }
    }

    private class ProxyChain(
        private val delegate: Interceptor.Chain,
        private val request: Request,
    ) : Interceptor.Chain by delegate {
        override fun request(): Request = request
    }
}

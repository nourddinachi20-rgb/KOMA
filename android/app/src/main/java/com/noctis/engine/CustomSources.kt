package com.noctis.engine

import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import okhttp3.Headers
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import org.koitharu.kotatsu.parsers.model.*
import org.koitharu.kotatsu.parsers.network.UserAgents
import org.koitharu.kotatsu.parsers.util.await
import java.text.SimpleDateFormat
import java.util.*

data class CustomSourceDef(
    val name: String,
    val title: String,
    val locale: String,
    val contentType: ContentType,
    val domain: String,
    val sortOrders: List<SortOrder>,
)

object CustomSourceRegistry {
    private val COVER_BASE = "https://bulbasaur.poke-black-and-white.net/covers/"
    private val BARE_JSON_MEDIA = "application/json".toMediaType()

    val defs: Map<String, CustomSourceDef> = listOf(
        CustomSourceDef(
            name = "MANGABALL_EN",
            title = "Manga Ball (EN)",
            locale = "en",
            contentType = ContentType.MANGA,
            domain = "mangaball.com",
            sortOrders = listOf(SortOrder.POPULARITY, SortOrder.UPDATED, SortOrder.RELEVANCE),
        ),
        CustomSourceDef(
            name = "MANGABALL_FR",
            title = "Manga Ball (FR)",
            locale = "fr",
            contentType = ContentType.MANGA,
            domain = "mangaball.com",
            sortOrders = listOf(SortOrder.POPULARITY, SortOrder.UPDATED, SortOrder.RELEVANCE),
        ),
        CustomSourceDef(
            name = "MANGABALL_AR",
            title = "Manga Ball (AR)",
            locale = "ar",
            contentType = ContentType.MANGA,
            domain = "mangaball.com",
            sortOrders = listOf(SortOrder.POPULARITY, SortOrder.UPDATED, SortOrder.RELEVANCE),
        ),
        CustomSourceDef(
            name = "MANGABALL_ALL",
            title = "Manga Ball (All)",
            locale = "",
            contentType = ContentType.MANGA,
            domain = "mangaball.com",
            sortOrders = listOf(SortOrder.POPULARITY, SortOrder.UPDATED, SortOrder.RELEVANCE),
        ),
    ).associateBy { it.name }

    fun isCustom(name: String?): Boolean = name != null && name in defs

    fun sourceToJson(def: CustomSourceDef): JSONObject = JSONObject().apply {
        put("name", def.name)
        put("title", def.title)
        put("locale", def.locale)
        put("contentType", def.contentType.name)
        put("isBroken", false)
        put("domain", def.domain)
        put("domains", JSONArray(listOf(def.domain, "mangaball.net")))
        put("sortOrders", JSONArray(def.sortOrders.map { it.name }))
        put("isSearchSupported", true)
        put("verified", true)
    }

    fun filterMetadataToJson(def: CustomSourceDef): JSONObject = JSONObject().apply {
        put("domain", def.domain)
        put("domains", JSONArray(listOf(def.domain, "mangaball.net")))
        put("sortOrders", JSONArray(def.sortOrders.map { it.name }))
        put("capabilities", JSONObject().apply {
            put("isMultipleTagsSupported", false)
            put("isTagsExclusionSupported", false)
            put("isSearchSupported", true)
            put("isSearchWithFiltersSupported", true)
            put("isYearSupported", false)
            put("isOriginalLocaleSupported", false)
            put("isAuthorSearchSupported", false)
        })
        put("availableTags", JSONArray())
        put("availableStates", JSONArray(listOf("ONGOING", "FINISHED", "PAUSED", "ABANDONED")))
        put("availableContentRating", JSONArray())
        put("availableContentTypes", JSONArray(listOf("MANGA", "MANHWA", "MANHUA")))
        put("availableDemographics", JSONArray())
        put("availableLocales", JSONArray())
    }

    private fun mangaBallHeaders(): Headers = Headers.Builder()
        .add("User-Agent", UserAgents.CHROME_DESKTOP)
        .add("X-Requested-With", "XMLHttpRequest")
        .add("Accept", "application/json")
        .add("Origin", "https://mangaball.com")
        .add("Referer", "https://mangaball.com/")
        .build()

    private suspend fun getJson(url: String): JSONObject {
        val req = Request.Builder().get().url(url).headers(mangaBallHeaders()).build()
        return NoctisMangaLoaderContext.httpClient.newCall(req).await().use { resp ->
            if (!resp.isSuccessful) error("MangaBall HTTP ${resp.code}")
            JSONObject(resp.body?.string() ?: "{}")
        }
    }

    private suspend fun postJson(url: String, jsonBody: JSONObject): JSONObject {
        val body = jsonBody.toString().toByteArray(Charsets.UTF_8).toRequestBody(BARE_JSON_MEDIA)
        val req = Request.Builder().post(body).url(url).headers(mangaBallHeaders()).build()
        return NoctisMangaLoaderContext.httpClient.newCall(req).await().use { resp ->
            if (!resp.isSuccessful) error("MangaBall HTTP ${resp.code}")
            JSONObject(resp.body?.string() ?: "{}")
        }
    }

    private fun extractImageUrl(imageObj: JSONObject?): String? {
        if (imageObj == null) return null
        val path = imageObj.optJSONObject("cover")?.optString("path", "")
            ?.trim()?.replace('\\', '/')?.takeIf { it.isNotEmpty() }
        if (path != null) {
            return if (path.startsWith("http")) path else "$COVER_BASE$path"
        }
        for (k in listOf("file", "cdn_mangadex", "cdn_mangaupdate", "cdn_mangaupdates")) {
            val v = imageObj.optString(k, "").trim()
            if (v.isNotEmpty()) return v
        }
        return null
    }

    private fun parseState(raw: String?): String? = when (raw?.lowercase()) {
        "ongoing" -> "ONGOING"
        "completed" -> "FINISHED"
        "hiatus" -> "PAUSED"
        "cancelled" -> "ABANDONED"
        else -> null
    }

    private fun parseDate(iso: String?): Long {
        if (iso.isNullOrBlank()) return 0L
        val clean = iso.substringBefore(".").substringBefore("+").substringBefore("Z")
        return runCatching {
            val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT)
            fmt.timeZone = TimeZone.getTimeZone("UTC")
            fmt.parse(clean)?.time ?: 0L
        }.getOrDefault(0L)
    }

    suspend fun getList(
        def: CustomSourceDef,
        offset: Int,
        order: String?,
        query: String?,
        showNsfw: Boolean = false,
    ): JSONArray {
        val page = (offset / 24) + 1
        val url = "https://mangaball.com/api/v1/title/search-advanced".toHttpUrl().newBuilder().apply {
            addQueryParameter("page", page.toString())
            addQueryParameter("limit", "24")
            val sortBy = when {
                !query.isNullOrBlank() && order == "RELEVANCE" -> null
                order == "UPDATED" -> "lastupdate"
                else -> "views"
            }
            if (sortBy != null) {
                addQueryParameter("sort_by", sortBy)
                addQueryParameter("sort_order", "desc")
            }
            addQueryParameter("tag_mode", "AND")
            addQueryParameter("adult_mode", if (showNsfw) "all" else "no_18")
            if (!query.isNullOrBlank()) {
                addQueryParameter("keyword", query.trim())
            }
            if (def.locale.isNotEmpty()) {
                addQueryParameter("chapterLanguage", def.locale)
            }
        }.build().toString()

        val root = getJson(url)
        val data = root.optJSONArray("data") ?: JSONArray()
        val out = JSONArray()
        for (i in 0 until data.length()) {
            val item = data.optJSONObject(i) ?: continue
            val id = item.optString("id", "").ifBlank { item.optString("_id", "") }
            if (id.isBlank()) continue
            val cover = extractImageUrl(item.optJSONObject("image"))

            val altArr = item.optJSONArray("alternateName") ?: JSONArray()
            val authorsArr = JSONArray()
            item.optJSONArray("authors")?.let { arr ->
                for (j in 0 until arr.length()) {
                    arr.optJSONObject(j)?.optString("name", "")?.takeIf { it.isNotBlank() }?.let { authorsArr.put(it) }
                }
            }
            val tagsArr = JSONArray()
            item.optJSONArray("tags")?.let { arr ->
                for (j in 0 until arr.length()) {
                    val t = arr.optJSONObject(j) ?: continue
                    val tName = t.optString("name", "")
                    val tKey = t.optString("id", tName)
                    if (tName.isNotBlank()) {
                        tagsArr.put(JSONObject().apply {
                            put("title", tName)
                            put("key", tKey)
                            put("source", def.name)
                        })
                    }
                }
            }
            val ratingAvg = item.optJSONObject("ratings")?.optDouble("rating_average", -1.0) ?: -1.0
            val rating = if (ratingAvg > 0) ratingAvg / 10.0 else -1.0

            out.put(JSONObject().apply {
                put("id", id)
                put("title", item.optString("name", "Untitled"))
                put("altTitles", altArr)
                put("url", id)
                put("publicUrl", "https://mangaball.com/title-detail/$id")
                put("rating", rating)
                put("contentRating", if (item.optBoolean("is18plus", false)) "ADULT" else "SAFE")
                put("coverUrl", cover)
                put("largeCoverUrl", cover)
                put("state", parseState(item.optString("status", "")))
                put("authors", authorsArr)
                put("description", JSONObject.NULL)
                put("source", def.name)
                put("tags", tagsArr)
                put("chapters", JSONObject.NULL)
            })
        }
        return out
    }

    suspend fun getDetails(def: CustomSourceDef, mangaObj: JSONObject): JSONObject = coroutineScope {
        val titleId = mangaObj.optString("url", "").ifBlank { mangaObj.optString("id", "") }
        val detailDeferred = async {
            runCatching { getJson("https://mangaball.com/api/v1/title/detail/$titleId") }.getOrNull()
        }
        val chaptersDeferred = async {
            runCatching {
                postJson(
                    "https://mangaball.com/api/v1/chapter/chapter-listing-by-title-id",
                    JSONObject().put("title_id", titleId),
                )
            }.getOrNull()
        }

        val detailData = detailDeferred.await()?.optJSONObject("data")
        val chaptersData = chaptersDeferred.await()?.optJSONArray("data") ?: JSONArray()

        val result = JSONObject(mangaObj.toString())
        if (detailData != null) {
            result.put("title", detailData.optString("name", result.optString("title")))
            val cover = extractImageUrl(detailData.optJSONObject("image")) ?: result.optString("coverUrl", "")
            if (cover.isNotBlank()) {
                result.put("coverUrl", cover)
                result.put("largeCoverUrl", cover)
            }
            detailData.optJSONArray("description")?.let { descArr ->
                val parts = (0 until descArr.length()).mapNotNull { descArr.optString(it).takeIf { s -> s.isNotBlank() } }
                if (parts.isNotEmpty()) result.put("description", parts.joinToString("\n\n"))
            }
            detailData.optJSONArray("authors")?.let { arr ->
                val authors = JSONArray()
                for (i in 0 until arr.length()) {
                    arr.optJSONObject(i)?.optString("name", "")?.takeIf { it.isNotBlank() }?.let { authors.put(it) }
                }
                if (authors.length() > 0) result.put("authors", authors)
            }
            detailData.optJSONArray("tags")?.let { arr ->
                val tags = JSONArray()
                for (i in 0 until arr.length()) {
                    val t = arr.optJSONObject(i) ?: continue
                    val name = t.optString("name", "")
                    if (name.isNotBlank()) {
                        tags.put(JSONObject().apply {
                            put("title", name)
                            put("key", t.optString("id", name))
                            put("source", def.name)
                        })
                    }
                }
                if (tags.length() > 0) result.put("tags", tags)
            }
            parseState(detailData.optString("status", ""))?.let { result.put("state", it) }
            val rAvg = detailData.optDouble("rating", -1.0)
            if (rAvg > 0) result.put("rating", rAvg / 10.0)
        }

        val allowedLangs = when (def.locale) {
            "en" -> setOf("en", "eng", "english")
            "fr" -> setOf("fr", "fre", "french")
            "ar" -> setOf("ar", "ara", "arabic")
            else -> null
        }

        val mappedChapters = mutableListOf<JSONObject>()
        for (i in 0 until chaptersData.length()) {
            val ch = chaptersData.optJSONObject(i) ?: continue
            val chLang = ch.optString("lang", "").lowercase()
            if (allowedLangs != null && chLang !in allowedLangs) continue
            val chId = ch.optString("id", "").ifBlank { ch.optString("_id", "") }
            if (chId.isBlank()) continue
            val num = ch.optDouble("number", ch.optDouble("chapter_number", 0.0))
            val vol = ch.optInt("volume", 0)
            val name = ch.optString("name", "").trim()
            val group = ch.optJSONObject("group")?.optString("name", "")?.takeIf { it.isNotBlank() }

            mappedChapters.add(JSONObject().apply {
                put("id", chId)
                put("title", name.ifBlank { JSONObject.NULL })
                put("number", if (num.isNaN() || num.isInfinite()) 0.0 else num)
                put("volume", vol)
                put("url", chId)
                put("scanlator", group ?: JSONObject.NULL)
                put("uploadDate", parseDate(ch.optString("created_at", "")))
                put("branch", if (allowedLangs == null && chLang.isNotBlank()) chLang.uppercase() else JSONObject.NULL)
                put("source", def.name)
            })
        }
        mappedChapters.sortBy { it.optDouble("number", 0.0) }
        result.put("chapters", JSONArray(mappedChapters))
        result
    }

    suspend fun getPages(def: CustomSourceDef, chapterObj: JSONObject): JSONArray {
        val chId = chapterObj.optString("url", "").ifBlank { chapterObj.optString("id", "") }
        val root = getJson("https://mangaball.com/api/v1/chapter-detail?chapter_id=$chId")
        val pages = root.optJSONObject("data")?.optJSONObject("chapter")?.optJSONArray("pages") ?: JSONArray()
        val out = JSONArray()
        for (i in 0 until pages.length()) {
            val url = pages.optString(i, "").trim()
            if (url.isBlank()) continue
            out.put(JSONObject().apply {
                put("id", "${chId}_$i")
                put("url", url)
                put("resolvedUrl", url)
                put("preview", JSONObject.NULL)
                put("source", def.name)
            })
        }
        return out
    }
}

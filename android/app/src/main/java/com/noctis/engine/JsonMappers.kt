package com.noctis.engine

import org.json.JSONArray
import org.json.JSONObject
import org.koitharu.kotatsu.parsers.MangaParser
import org.koitharu.kotatsu.parsers.model.*
import java.util.*

object JsonMappers {

    fun sourceToJson(source: MangaParserSource, parser: MangaParser? = null): JSONObject {
        val obj = JSONObject()
        obj.put("name", source.name)
        obj.put("title", source.title)
        obj.put("locale", source.locale)
        obj.put("contentType", source.contentType.name)
        obj.put("isBroken", source.isBroken)
        if (parser != null) {
            obj.put("domain", parser.domain)
            obj.put("domains", JSONArray(parser.configKeyDomain.presetValues.toList()))
            obj.put("sortOrders", JSONArray(parser.availableSortOrders.map { it.name }))
            obj.put("isSearchSupported", parser.filterCapabilities.isSearchSupported)
        }
        return obj
    }

    fun mangaToJson(m: Manga): JSONObject {
        val obj = JSONObject()
        obj.put("id", m.id.toString())
        obj.put("title", m.title)
        obj.put("altTitles", JSONArray(m.altTitles.toList()))
        obj.put("url", m.url)
        obj.put("publicUrl", m.publicUrl)
        val safeRating = if (m.rating.isNaN() || m.rating.isInfinite() || m.rating < 0f) -1f else m.rating
        obj.put("rating", safeRating.toDouble())
        obj.put("contentRating", m.contentRating?.name)
        obj.put("coverUrl", m.coverUrl)
        obj.put("largeCoverUrl", m.largeCoverUrl)
        obj.put("state", m.state?.name)
        obj.put("authors", JSONArray(m.authors.toList()))
        obj.put("description", m.description)
        obj.put("source", m.source.name)

        val tagsArr = JSONArray()
        for (t in m.tags) {
            tagsArr.put(tagToJson(t))
        }
        obj.put("tags", tagsArr)

        if (m.chapters != null) {
            val chArr = JSONArray()
            for (ch in m.chapters!!) {
                chArr.put(chapterToJson(ch))
            }
            obj.put("chapters", chArr)
        } else {
            obj.put("chapters", JSONObject.NULL)
        }
        return obj
    }

    fun jsonToManga(obj: JSONObject, fallbackSource: MangaParserSource): Manga {
        val sourceName = obj.optString("source", fallbackSource.name)
        val src = runCatching { MangaParserSource.valueOf(sourceName) }.getOrDefault(fallbackSource)
        val altTitles = mutableSetOf<String>()
        obj.optJSONArray("altTitles")?.let { arr ->
            for (i in 0 until arr.length()) {
                val s = arr.optString(i, "")
                if (s.isNotEmpty()) altTitles.add(s)
            }
        }
        val authors = mutableSetOf<String>()
        obj.optJSONArray("authors")?.let { arr ->
            for (i in 0 until arr.length()) {
                val s = arr.optString(i, "")
                if (s.isNotEmpty()) authors.add(s)
            }
        }
        val tags = mutableSetOf<MangaTag>()
        obj.optJSONArray("tags")?.let { arr ->
            for (i in 0 until arr.length()) {
                arr.optJSONObject(i)?.let { tags.add(jsonToTag(it, src)) }
            }
        }
        val contentRating = obj.optString("contentRating", "").takeIf { it.isNotEmpty() }?.let {
            runCatching { ContentRating.valueOf(it) }.getOrNull()
        }
        val state = obj.optString("state", "").takeIf { it.isNotEmpty() }?.let {
            runCatching { MangaState.valueOf(it) }.getOrNull()
        }
        val idStr = obj.opt("id")?.toString() ?: "0"
        val id = idStr.toLongOrNull() ?: 0L
        val rating = obj.optDouble("rating", -1.0).toFloat()

        return Manga(
            id = id,
            title = obj.optString("title", ""),
            altTitles = altTitles,
            url = obj.optString("url", ""),
            publicUrl = obj.optString("publicUrl", ""),
            rating = rating,
            contentRating = contentRating,
            coverUrl = obj.optString("coverUrl", "").takeIf { it.isNotEmpty() },
            tags = tags,
            state = state,
            authors = authors,
            largeCoverUrl = obj.optString("largeCoverUrl", "").takeIf { it.isNotEmpty() },
            description = obj.optString("description", "").takeIf { it.isNotEmpty() },
            chapters = null,
            source = src,
        )
    }

    fun tagToJson(t: MangaTag): JSONObject = JSONObject().apply {
        put("title", t.title)
        put("key", t.key)
        put("source", t.source.name)
    }

    fun jsonToTag(obj: JSONObject, fallbackSource: MangaParserSource): MangaTag {
        val srcName = obj.optString("source", fallbackSource.name)
        val src = runCatching { MangaParserSource.valueOf(srcName) }.getOrDefault(fallbackSource)
        return MangaTag(
            title = obj.optString("title", ""),
            key = obj.optString("key", ""),
            source = src,
        )
    }

    fun chapterToJson(ch: MangaChapter): JSONObject = JSONObject().apply {
        put("id", ch.id.toString())
        put("title", ch.title)
        val safeNumber = if (ch.number.isNaN() || ch.number.isInfinite()) 0f else ch.number
        put("number", safeNumber.toDouble())
        put("volume", ch.volume)
        put("url", ch.url)
        put("scanlator", ch.scanlator)
        put("uploadDate", ch.uploadDate)
        put("branch", ch.branch)
        put("source", ch.source.name)
    }

    fun jsonToChapter(obj: JSONObject, fallbackSource: MangaParserSource): MangaChapter {
        val srcName = obj.optString("source", fallbackSource.name)
        val src = runCatching { MangaParserSource.valueOf(srcName) }.getOrDefault(fallbackSource)
        val idStr = obj.opt("id")?.toString() ?: "0"
        return MangaChapter(
            id = idStr.toLongOrNull() ?: 0L,
            title = obj.optString("title", "").takeIf { it.isNotEmpty() },
            number = obj.optDouble("number", 0.0).toFloat(),
            volume = obj.optInt("volume", 0),
            url = obj.optString("url", ""),
            scanlator = obj.optString("scanlator", "").takeIf { it.isNotEmpty() },
            uploadDate = obj.optLong("uploadDate", 0L),
            branch = obj.optString("branch", "").takeIf { it.isNotEmpty() },
            source = src,
        )
    }

    fun pageToJson(p: MangaPage): JSONObject = JSONObject().apply {
        put("id", p.id.toString())
        put("url", p.url)
        put("preview", p.preview)
        put("source", p.source.name)
    }

    fun jsonToPage(obj: JSONObject, fallbackSource: MangaParserSource): MangaPage {
        val srcName = obj.optString("source", fallbackSource.name)
        val src = runCatching { MangaParserSource.valueOf(srcName) }.getOrDefault(fallbackSource)
        val idStr = obj.opt("id")?.toString() ?: "0"
        return MangaPage(
            id = idStr.toLongOrNull() ?: 0L,
            url = obj.optString("url", ""),
            preview = obj.optString("preview", "").takeIf { it.isNotEmpty() },
            source = src,
        )
    }

    fun jsonToFilter(obj: JSONObject?, source: MangaParserSource): MangaListFilter {
        if (obj == null) return MangaListFilter.EMPTY
        val query = obj.optString("query", "").takeIf { it.isNotBlank() }
        val tags = mutableSetOf<MangaTag>()
        obj.optJSONArray("tags")?.let { arr ->
            for (i in 0 until arr.length()) {
                arr.optJSONObject(i)?.let { tags.add(jsonToTag(it, source)) }
            }
        }
        val tagsExclude = mutableSetOf<MangaTag>()
        obj.optJSONArray("tagsExclude")?.let { arr ->
            for (i in 0 until arr.length()) {
                arr.optJSONObject(i)?.let { tagsExclude.add(jsonToTag(it, source)) }
            }
        }
        val states = mutableSetOf<MangaState>()
        obj.optJSONArray("states")?.let { arr ->
            for (i in 0 until arr.length()) {
                runCatching { MangaState.valueOf(arr.optString(i)) }.getOrNull()?.let { states.add(it) }
            }
        }
        val ratings = mutableSetOf<ContentRating>()
        obj.optJSONArray("contentRating")?.let { arr ->
            for (i in 0 until arr.length()) {
                runCatching { ContentRating.valueOf(arr.optString(i)) }.getOrNull()?.let { ratings.add(it) }
            }
        }
        val types = mutableSetOf<ContentType>()
        obj.optJSONArray("types")?.let { arr ->
            for (i in 0 until arr.length()) {
                runCatching { ContentType.valueOf(arr.optString(i)) }.getOrNull()?.let { types.add(it) }
            }
        }
        val demographics = mutableSetOf<Demographic>()
        obj.optJSONArray("demographics")?.let { arr ->
            for (i in 0 until arr.length()) {
                runCatching { Demographic.valueOf(arr.optString(i)) }.getOrNull()?.let { demographics.add(it) }
            }
        }
        val locale = obj.optString("locale", "").takeIf { it.isNotBlank() }?.let { Locale(it) }
        return MangaListFilter(
            query = query,
            tags = tags,
            tagsExclude = tagsExclude,
            locale = locale,
            states = states,
            contentRating = ratings,
            types = types,
            demographics = demographics,
        )
    }

    fun filterMetadataToJson(
        parser: MangaParser,
        options: MangaListFilterOptions,
    ): JSONObject {
        val obj = JSONObject()
        obj.put("domain", parser.domain)
        obj.put("domains", JSONArray(parser.configKeyDomain.presetValues.toList()))
        obj.put("sortOrders", JSONArray(parser.availableSortOrders.map { it.name }))

        val caps = parser.filterCapabilities
        obj.put("capabilities", JSONObject().apply {
            put("isMultipleTagsSupported", caps.isMultipleTagsSupported)
            put("isTagsExclusionSupported", caps.isTagsExclusionSupported)
            put("isSearchSupported", caps.isSearchSupported)
            put("isSearchWithFiltersSupported", caps.isSearchWithFiltersSupported)
            put("isYearSupported", caps.isYearSupported)
            put("isOriginalLocaleSupported", caps.isOriginalLocaleSupported)
            put("isAuthorSearchSupported", caps.isAuthorSearchSupported)
        })

        obj.put("availableTags", JSONArray(options.availableTags.map { tagToJson(it) }))
        obj.put("availableStates", JSONArray(options.availableStates.map { it.name }))
        obj.put("availableContentRating", JSONArray(options.availableContentRating.map { it.name }))
        obj.put("availableContentTypes", JSONArray(options.availableContentTypes.map { it.name }))
        obj.put("availableDemographics", JSONArray(options.availableDemographics.map { it.name }))
        obj.put("availableLocales", JSONArray(options.availableLocales.map { it.language }))
        return obj
    }
}

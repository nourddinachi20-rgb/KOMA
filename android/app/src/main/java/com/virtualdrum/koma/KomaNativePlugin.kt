package com.virtualdrum.koma

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.provider.Settings
import android.util.Base64
import androidx.activity.result.ActivityResult
import androidx.core.content.FileProvider
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.noctis.engine.AndroidKomaEngine
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import java.util.concurrent.TimeUnit
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream

@CapacitorPlugin(name = "KomaNative")
class KomaNativePlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val storageMutex = Mutex()
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(40, TimeUnit.SECONDS)
        .build()

    private val dataDir: File
        get() = File(context.filesDir, "noctis-data").apply { mkdirs() }

    private val downloadsDir: File
        get() = File(dataDir, "downloads").apply { mkdirs() }

    private val localCbzDir: File
        get() = File(dataDir, "local-cbz").apply { mkdirs() }

    private val metadataCache = mutableMapOf<String, JSONObject?>()
    private val logs = mutableListOf<String>()
    private var pendingBackupJson: String? = null

    override fun load() {
        super.load()
        scope.launch {
            startEmbeddedEngine()
        }
    }

    private fun startEmbeddedEngine() {
        try {
            AndroidKomaEngine.start(context.filesDir, context.cacheDir) { port, count ->
                logs.add("Android KOMA Engine started on 127.0.0.1:$port ($count sources)")
                notifyEngineStatus()
            }
        } catch (t: Throwable) {
            logs.add("Engine start error: ${t.message}")
            val err = JSObject().apply {
                put("ready", false)
                put("port", JSONObject.NULL)
                put("url", JSONObject.NULL)
                put("sourcesCount", 0)
                put("error", t.message ?: "Failed to start engine")
            }
            notifyListeners("engineStatus", err)
        }
    }

    private fun engineStatusJson(): JSObject {
        val ready = AndroidKomaEngine.ready
        val port = AndroidKomaEngine.port
        return JSObject().apply {
            put("ready", ready)
            put("port", if (ready) port else JSONObject.NULL)
            put("url", if (ready) "http://127.0.0.1:$port" else JSONObject.NULL)
            put("sourcesCount", AndroidKomaEngine.sourcesCount)
            put("error", JSONObject.NULL)
        }
    }

    private fun notifyEngineStatus() {
        notifyListeners("engineStatus", engineStatusJson())
    }

    @PluginMethod
    fun getEngineStatus(call: PluginCall) {
        call.resolve(engineStatusJson())
    }

    @PluginMethod
    fun restartEngine(call: PluginCall) {
        scope.launch {
            AndroidKomaEngine.stop()
            startEmbeddedEngine()
            call.resolve(engineStatusJson())
        }
    }

    @PluginMethod
    fun getSplashCoverPaths(call: PluginCall) {
        // Native Splash covers load through the embedded proxy once ready (~250ms)
        call.resolve(JSObject().put("paths", JSArray()))
    }

    @PluginMethod
    fun getOfflinePagePaths(call: PluginCall) {
        val cbzPath = call.getString("cbzPath") ?: ""
        scope.launch {
            try {
                val file = File(cbzPath)
                if (!file.exists()) {
                    call.resolve(JSObject().put("paths", JSArray()))
                    return@launch
                }
                val hash = sha256(file.absolutePath + "|" + file.lastModified())
                val extractDir = File(context.cacheDir, "cbz-pages/$hash").apply { mkdirs() }
                val existing = extractDir.listFiles()?.filter { it.isFile }?.sortedBy { it.name } ?: emptyList()
                val outPaths = if (existing.isNotEmpty()) {
                    existing.map { it.absolutePath }
                } else {
                    val created = mutableListOf<String>()
                    ZipFile(file).use { zip ->
                        val imgs = zip.entries().asSequence()
                            .filter { !it.isDirectory && isImageName(it.name) }
                            .sortedWith { a, b -> naturalCompare(a.name, b.name) }
                            .toList()
                        imgs.forEachIndexed { idx, entry ->
                            val ext = entry.name.substringAfterLast('.', "jpg")
                            val outFile = File(extractDir, "%04d.%s".format(idx, ext))
                            zip.getInputStream(entry).use { input ->
                                FileOutputStream(outFile).use { output -> input.copyTo(output) }
                            }
                            created.add(outFile.absolutePath)
                        }
                    }
                    created
                }
                val arr = JSArray()
                outPaths.forEach { arr.put(it) }
                call.resolve(JSObject().put("paths", arr))
            } catch (t: Throwable) {
                call.reject(t.message ?: "Failed to read CBZ")
            }
        }
    }

    @PluginMethod
    fun solveCloudflare(call: PluginCall) {
        val url = call.getString("url") ?: return call.resolve(JSObject().put("ok", false).put("injected", 0))
        val intent = Intent(context, CloudflareWebViewActivity::class.java).apply {
            putExtra("url", url)
        }
        startActivityForResult(call, intent, "onCloudflareResult")
    }

    @ActivityCallback
    fun onCloudflareResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val ok = result.resultCode == Activity.RESULT_OK
        val injected = result.data?.getIntExtra("injected", 0) ?: 0
        call.resolve(JSObject().put("ok", ok).put("injected", injected))
    }

    @PluginMethod
    fun pickCbzFiles(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/x-cbz", "application/zip", "application/octet-stream"))
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        startActivityForResult(call, intent, "onCbzPicked")
    }

    @ActivityCallback
    fun onCbzPicked(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            call.resolve(JSObject().put("json", readFileText("library.json", "[]")))
            return
        }
        scope.launch {
            val uris = mutableListOf<Uri>()
            result.data?.clipData?.let { clip ->
                for (i in 0 until clip.itemCount) uris.add(clip.getItemAt(i).uri)
            } ?: result.data?.data?.let { uris.add(it) }

            for (uri in uris) {
                importSingleCbzUri(uri)
            }
            call.resolve(JSObject().put("json", readFileText("library.json", "[]")))
        }
    }

    private fun importSingleCbzUri(uri: Uri) {
        runCatching {
            val fileName = getDisplayName(uri) ?: "imported-${System.currentTimeMillis()}.cbz"
            val title = fileName.substringBeforeLast('.')
            val dest = File(localCbzDir, "${System.currentTimeMillis()}-$fileName")
            context.contentResolver.openInputStream(uri)?.use { input ->
                FileOutputStream(dest).use { output -> input.copyTo(output) }
            } ?: return
            val id = "local-${sha256(dest.absolutePath).take(12)}"
            val mangaObj = JSONObject().apply {
                put("id", id)
                put("title", title)
                put("altTitles", JSONArray())
                put("url", dest.absolutePath)
                put("publicUrl", "")
                put("rating", -1)
                put("contentRating", JSONObject.NULL)
                put("coverUrl", JSONObject.NULL)
                put("largeCoverUrl", JSONObject.NULL)
                put("state", "FINISHED")
                put("authors", JSONArray().put("Local Archive"))
                put("description", "Imported local CBZ archive.")
                put("source", "LOCAL")
                put("tags", JSONArray().put(JSONObject().put("key", "local").put("title", "Local CBZ").put("source", "LOCAL")))
                put("chapters", JSONArray().put(JSONObject().apply {
                    put("id", "$id-ch1")
                    put("title", fileName)
                    put("number", 1)
                    put("volume", 1)
                    put("url", dest.absolutePath)
                    put("scanlator", "Local File")
                    put("uploadDate", System.currentTimeMillis())
                    put("branch", JSONObject.NULL)
                    put("source", "LOCAL")
                }))
            }
            val entry = JSONObject().apply {
                put("key", "LOCAL::$id")
                put("manga", mangaObj)
                put("categoryIds", JSONArray().put("reading"))
                put("addedAt", System.currentTimeMillis())
                put("lastReadAt", System.currentTimeMillis())
                put("unreadCount", 1)
                put("totalChapters", 1)
                put("readChapterIds", JSONArray())
                put("knownChapterIds", JSONArray().put("$id-ch1"))
            }
            val lib = JSONArray(readFileText("library.json", "[]"))
            val updated = JSONArray()
            updated.put(entry)
            for (i in 0 until lib.length()) {
                val e = lib.getJSONObject(i)
                if (e.optString("key") != "LOCAL::$id") updated.put(e)
            }
            writeFileText("library.json", updated.toString(2))
        }
    }

    @PluginMethod
    fun saveBackupFile(call: PluginCall) {
        pendingBackupJson = call.getString("json") ?: "{}"
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_TITLE, "koma-backup.json")
        }
        startActivityForResult(call, intent, "onBackupSaved")
    }

    @ActivityCallback
    fun onBackupSaved(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val uri = result.data?.data
        val json = pendingBackupJson
        pendingBackupJson = null
        if (result.resultCode == Activity.RESULT_OK && uri != null && json != null) {
            runCatching {
                context.contentResolver.openOutputStream(uri)?.use { it.write(json.toByteArray(Charsets.UTF_8)) }
                call.resolve(JSObject().put("ok", true))
            }.getOrElse {
                call.resolve(JSObject().put("ok", false))
            }
        } else {
            call.resolve(JSObject().put("ok", false))
        }
    }

    @PluginMethod
    fun pickBackupFile(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
        }
        startActivityForResult(call, intent, "onBackupPicked")
    }

    @ActivityCallback
    fun onBackupPicked(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val uri = result.data?.data
        if (result.resultCode == Activity.RESULT_OK && uri != null) {
            val b64 = runCatching {
                val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: ByteArray(0)
                if (bytes.isEmpty()) "" else Base64.encodeToString(bytes, Base64.NO_WRAP)
            }.getOrDefault("")
            val name = getDisplayName(uri) ?: uri.lastPathSegment ?: "backup"
            call.resolve(JSObject().put("base64", b64).put("fileName", name))
        } else {
            call.resolve(JSObject().put("base64", "").put("fileName", ""))
        }
    }

    @PluginMethod
    fun call(call: PluginCall) {
        val method = call.getString("method") ?: return call.reject("Missing method")
        val args = JSONObject(call.getString("argsJson") ?: "{}")
        scope.launch {
            try {
                val resJson = dispatchRpc(method, args)
                call.resolve(JSObject().put("json", resJson))
            } catch (t: Throwable) {
                call.reject(t.message ?: "RPC failed")
            }
        }
    }

    private suspend fun dispatchRpc(method: String, args: JSONObject): String {
        val needsLock = method in setOf(
            "saveCategories", "upsertLibrary", "removeLibrary",
            "clearUpdates", "upsertHistory", "removeHistory",
            "saveSettings", "saveHomeCache", "deleteDownload",
            "importBackupJson", "recordStats", "setAniListToken",
            "disconnectAniList"
        )
        return if (needsLock) {
            storageMutex.withLock { dispatchRpcUnlocked(method, args) }
        } else {
            dispatchRpcUnlocked(method, args)
        }
    }

    private suspend fun dispatchRpcUnlocked(method: String, args: JSONObject): String {
        return when (method) {
            "getEngineLogs" -> JSONArray(logs).toString()
            "getCategories" -> ensureDefaultCategories()
            "saveCategories" -> {
                val cats = args.getJSONArray("categories")
                writeFileText("categories.json", cats.toString(2))
                cats.toString()
            }
            "getLibrary" -> readFileText("library.json", "[]")
            "upsertLibrary" -> {
                val entry = args.getJSONObject("entry")
                val arr = JSONArray(readFileText("library.json", "[]"))
                val out = JSONArray()
                var replaced = false
                for (i in 0 until arr.length()) {
                    val cur = arr.getJSONObject(i)
                    if (cur.optString("key") == entry.optString("key")) {
                        out.put(entry)
                        replaced = true
                    } else {
                        out.put(cur)
                    }
                }
                if (!replaced) {
                    val prepended = JSONArray().put(entry)
                    for (i in 0 until out.length()) prepended.put(out.get(i))
                    writeFileText("library.json", prepended.toString())
                    return prepended.toString()
                }
                writeFileText("library.json", out.toString())
                out.toString()
            }
            "removeLibrary" -> {
                val key = args.getString("key")
                val arr = JSONArray(readFileText("library.json", "[]"))
                val out = JSONArray()
                for (i in 0 until arr.length()) {
                    val cur = arr.getJSONObject(i)
                    if (cur.optString("key") != key) out.put(cur)
                }
                writeFileText("library.json", out.toString())
                out.toString()
            }
            "getUpdates" -> readFileText("updates.json", "[]")
            "clearUpdates" -> {
                writeFileText("updates.json", "[]")
                "[]"
            }
            "checkUpdates" -> checkLibraryUpdatesRpc()
            "getStats" -> readFileText("stats.json", DEFAULT_STATS)
            "recordStats" -> recordStatsRpc(args)
            "getHistory" -> readFileText("history.json", "[]")
            "upsertHistory" -> {
                val entry = args.getJSONObject("entry")
                val arr = JSONArray(readFileText("history.json", "[]"))
                val out = JSONArray().put(entry)
                for (i in 0 until arr.length()) {
                    if (out.length() >= 150) break
                    val cur = arr.getJSONObject(i)
                    if (cur.optString("key") != entry.optString("key")) out.put(cur)
                }
                writeFileText("history.json", out.toString(2))
                out.toString()
            }
            "removeHistory" -> {
                val key = args.getString("key")
                val arr = JSONArray(readFileText("history.json", "[]"))
                val out = JSONArray()
                for (i in 0 until arr.length()) {
                    val cur = arr.getJSONObject(i)
                    if (cur.optString("key") != key) out.put(cur)
                }
                writeFileText("history.json", out.toString(2))
                out.toString()
            }
            "getSettings" -> mergeSettings().toString()
            "saveSettings" -> {
                val cur = mergeSettings()
                val patch = args.getJSONObject("patch")
                for (k in patch.keys()) cur.put(k, patch.get(k))
                writeFileText("settings.json", cur.toString(2))
                cur.toString()
            }
            "getHomeCache" -> readFileText("home-cache.json", "null")
            "saveHomeCache" -> {
                val snap = args.getJSONObject("snapshot")
                writeFileText("home-cache.json", snap.toString())
                "{}"
            }
            "getDownloads" -> readDownloadsJson().toString()
            "deleteDownload" -> {
                val key = args.getString("key")
                val arr = readDownloadsJson()
                val out = JSONArray()
                for (i in 0 until arr.length()) {
                    val cur = arr.getJSONObject(i)
                    if (cur.optString("key") == key) {
                        runCatching { File(cur.optString("cbzPath")).delete() }
                    } else {
                        out.put(cur)
                    }
                }
                writeFileText("downloads.json", out.toString(2))
                out.toString()
            }
            "downloadChapter" -> downloadChapterRpc(args).toString()
            "exportBackupJson" -> JSONObject().apply {
                put("version", 1)
                put("exportedAt", System.currentTimeMillis())
                put("categories", JSONArray(ensureDefaultCategories()))
                put("library", JSONArray(readFileText("library.json", "[]")))
                put("history", JSONArray(readFileText("history.json", "[]")))
                put("settings", mergeSettings())
                put("stats", JSONObject(readFileText("stats.json", DEFAULT_STATS)))
            }.toString(2)
            "importBackupJson" -> {
                val raw = JSONObject(args.getString("json"))
                raw.optJSONArray("categories")?.let { writeFileText("categories.json", it.toString()) }
                raw.optJSONArray("library")?.let { writeFileText("library.json", it.toString()) }
                raw.optJSONArray("history")?.let { writeFileText("history.json", it.toString()) }
                raw.optJSONObject("settings")?.let { writeFileText("settings.json", it.toString(2)) }
                raw.optJSONObject("stats")?.let { writeFileText("stats.json", it.toString(2)) }
                "true"
            }
            "getTrackerConfig" -> trackerPublicConfig().toString()
            "setAniListToken" -> setAniListTokenRpc(args.optString("token", ""))
            "disconnectAniList" -> {
                writeFileText("tracker.json", "{}")
                "{}"
            }
            "fetchAniListMetadata" -> {
                val meta = fetchAniListMetadata(args.optString("title", ""), args.optString("altTitle", ""))
                meta?.toString() ?: "null"
            }
            "syncAniListProgress" -> syncAniListProgressRpc(args.optString("mangaTitle", ""), args.optInt("chapterNumber", 0))
            "getAniListLists" -> getAniListListsRpc()
            "getAppVersion" -> JSONObject.quote(getAppVersionString())
            "checkForUpdate" -> checkForAndroidUpdateRpc(args.optString("repo", ""))
            "downloadAndInstallUpdate" -> downloadAndInstallAndroidUpdateRpc(args)
            else -> throw IllegalArgumentException("Unknown RPC method: $method")
        }
    }

    private fun getAppVersionString(): String =
        runCatching {
            @Suppress("DEPRECATION")
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "1.0.0"
        }.getOrDefault("1.0.0")

    private fun compareSemver(a: String, b: String): Int {
        val pa = a.removePrefix("v").removePrefix("V").split(".").map { it.toIntOrNull() ?: 0 }
        val pb = b.removePrefix("v").removePrefix("V").split(".").map { it.toIntOrNull() ?: 0 }
        val len = maxOf(pa.size, pb.size, 3)
        for (i in 0 until len) {
            val va = pa.getOrElse(i) { 0 }
            val vb = pb.getOrElse(i) { 0 }
            if (va > vb) return 1
            if (va < vb) return -1
        }
        return 0
    }

    private fun checkForAndroidUpdateRpc(repoArg: String): String {
        val currentVersion = getAppVersionString()
        val repo = repoArg.ifBlank { mergeSettings().optString("githubRepo", "nourddinachi20-rgb/KOMA") }.trim()
        return runCatching {
            val req = Request.Builder()
                .url("https://api.github.com/repos/$repo/releases/latest")
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "KOMA-Android-Updater")
                .build()
            http.newCall(req).execute().use { res ->
                if (!res.isSuccessful) {
                    return@use JSONObject().apply {
                        put("currentVersion", currentVersion)
                        put("latestVersion", currentVersion)
                        put("hasUpdate", false)
                        put("releaseName", "v$currentVersion")
                        put("notes", "")
                        put(
                            "error",
                            if (res.code == 404) "No GitHub releases published yet for $repo"
                            else "GitHub API returned ${res.code}",
                        )
                    }.toString()
                }
                val json = JSONObject(res.body?.string() ?: "{}")
                val tag = json.optString("tag_name").ifBlank { json.optString("name", currentVersion) }
                val latestVersion = tag.removePrefix("v").removePrefix("V").trim()
                val assets = json.optJSONArray("assets") ?: JSONArray()
                var apkAsset: JSONObject? = null
                for (i in 0 until assets.length()) {
                    val a = assets.getJSONObject(i)
                    val name = a.optString("name", "").lowercase()
                    if (name.endsWith(".apk")) {
                        apkAsset = a
                        break
                    }
                }
                JSONObject().apply {
                    put("currentVersion", currentVersion)
                    put("latestVersion", latestVersion)
                    put("hasUpdate", compareSemver(latestVersion, currentVersion) > 0)
                    put("releaseName", json.optString("name").ifBlank { "v$latestVersion" })
                    put("notes", json.optString("body", ""))
                    put("publishedAt", json.optString("published_at", ""))
                    put("htmlUrl", json.optString("html_url", ""))
                    if (apkAsset != null) {
                        put("downloadUrl", apkAsset.optString("browser_download_url"))
                        put("assetName", apkAsset.optString("name"))
                        put("assetSize", apkAsset.optLong("size", 0))
                    }
                }.toString()
            }
        }.getOrElse { err ->
            JSONObject().apply {
                put("currentVersion", currentVersion)
                put("latestVersion", currentVersion)
                put("hasUpdate", false)
                put("releaseName", "v$currentVersion")
                put("notes", "")
                put("error", err.message ?: "Update check failed")
            }.toString()
        }
    }

    private fun downloadAndInstallAndroidUpdateRpc(payload: JSONObject): String {
        val downloadUrl = payload.optString("downloadUrl", "")
        if (downloadUrl.isBlank()) {
            return JSONObject().put("started", false).put("error", "Missing APK download URL").toString()
        }
        val notes = payload.optString("notes", "")
        return runCatching {
            val updatesDir = File(context.cacheDir, "updates").apply { mkdirs() }
            val apkFile = File(updatesDir, "KOMA-update.apk")

            val req = Request.Builder().url(downloadUrl).header("User-Agent", "KOMA-Android-Updater").build()
            http.newCall(req).execute().use { res ->
                if (!res.isSuccessful || res.body == null) error("Download failed (${res.code})")
                val total = res.body!!.contentLength()
                val buf = ByteArray(16 * 1024)
                var downloaded = 0L
                var lastEmit = 0L
                res.body!!.byteStream().use { input ->
                    FileOutputStream(apkFile).use { output ->
                        while (true) {
                            val read = input.read(buf)
                            if (read <= 0) break
                            output.write(buf, 0, read)
                            downloaded += read
                            val now = System.currentTimeMillis()
                            if (now - lastEmit > 140) {
                                lastEmit = now
                                val pct = if (total > 0) ((downloaded * 100) / total).toInt().coerceAtMost(99) else 50
                                notifyListeners("updateProgress", JSObject().apply {
                                    put("downloaded", downloaded)
                                    put("total", total)
                                    put("percent", pct)
                                    put("status", "downloading")
                                })
                            }
                        }
                    }
                }
            }

            // Persist release notes so post-update launch displays What's New
            val curSettings = mergeSettings()
            curSettings.put("pendingWhatsNewNotes", notes)
            writeFileText("settings.json", curSettings.toString(2))

            notifyListeners("updateProgress", JSObject().apply {
                put("downloaded", apkFile.length())
                put("total", apkFile.length())
                put("percent", 100)
                put("status", "installing")
            })

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.packageManager.canRequestPackageInstalls()) {
                val permIntent = Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${context.packageName}"),
                ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
                context.startActivity(permIntent)
                return@runCatching JSONObject()
                    .put("started", false)
                    .put("error", "Allow 'Install unknown apps' for KOMA in Android Settings, then tap Install Update again.")
                    .toString()
            }

            val contentUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apkFile)
            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(installIntent)
            JSONObject().put("started", true).toString()
        }.getOrElse { err ->
            val msg = err.message ?: "APK update failed"
            notifyListeners("updateProgress", JSObject().apply {
                put("downloaded", 0)
                put("total", 0)
                put("percent", 0)
                put("status", "error")
                put("message", msg)
            })
            JSONObject().put("started", false).put("error", msg).toString()
        }
    }

    private suspend fun checkLibraryUpdatesRpc(): String {
        val snapshotLib = storageMutex.withLock { JSONArray(readFileText("library.json", "[]")) }
        val existingUpdatesSnap = storageMutex.withLock { JSONArray(readFileText("updates.json", "[]")) }
        if (!AndroidKomaEngine.ready) {
            return JSONObject().put("updates", existingUpdatesSnap).put("library", snapshotLib).put("newCount", 0).toString()
        }

        val engineUrl = "http://127.0.0.1:${AndroidKomaEngine.port}"
        val fastHttp = http.newBuilder()
            .callTimeout(15, TimeUnit.SECONDS)
            .readTimeout(14, TimeUnit.SECONDS)
            .build()

        val targets = mutableListOf<JSONObject>()
        for (i in 0 until snapshotLib.length()) {
            val e = snapshotLib.getJSONObject(i)
            val src = e.optJSONObject("manga")?.optString("source") ?: ""
            if (src.isNotBlank() && src != "LOCAL") targets.add(e)
        }

        val knownDead = setOf(
            "MANGAPARK", "MANGASEE", "MANGALIFE", "COMICK", "COMICK_FUN",
            "REAPER_SCANS", "FLAMESCANS", "LUMINOUSSCANS", "MANHUARM", "MANGA_DEMON",
        )
        val verifiedSet = mutableSetOf<String>()
        runCatching {
            val sReq = Request.Builder().url("$engineUrl/api/sources?includeUnverified=false").build()
            http.newBuilder().callTimeout(3, TimeUnit.SECONDS).build().newCall(sReq).execute().use { sRes ->
                if (sRes.isSuccessful) {
                    val arr = JSONObject(sRes.body?.string() ?: "{}").optJSONArray("sources") ?: JSONArray()
                    for (idx in 0 until arr.length()) {
                        val name = arr.getJSONObject(idx).optString("name")
                        if (name.isNotBlank()) verifiedSet.add(name)
                    }
                }
            }
        }

        data class CheckedResult(
            val key: String,
            val ok: Boolean,
            val detailedManga: JSONObject?,
            val nextKnown: JSONArray?,
            val totalChapters: Int,
            val unreadCount: Int,
            val updatesForManga: List<JSONObject>,
        )

        val checkedMap = mutableMapOf<String, CheckedResult>()
        val liveTargets = mutableListOf<JSONObject>()
        for (entry in targets) {
            val mKey = entry.optString("key")
            val src = entry.optJSONObject("manga")?.optString("source") ?: ""
            if (src in knownDead || (verifiedSet.isNotEmpty() && src !in verifiedSet)) {
                checkedMap[mKey] = CheckedResult(mKey, false, null, null, 0, 0, emptyList())
            } else {
                liveTargets.add(entry)
            }
        }

        val sem = Semaphore(6)
        val results = coroutineScope {
            liveTargets.map { entry ->
                async<CheckedResult?>(Dispatchers.IO) {
                    sem.withPermit {
                        val mKey = entry.optString("key")
                        runCatching {
                            val manga = entry.getJSONObject("manga")
                            val source = manga.optString("source")
                            val req = Request.Builder()
                                .url("$engineUrl/api/sources/${Uri.encode(source)}/details")
                                .post(JSONObject().put("manga", manga).toString().toRequestBody("application/json".toMediaType()))
                                .build()
                            fastHttp.newCall(req).execute().use { res ->
                                if (!res.isSuccessful) {
                                    return@runCatching CheckedResult(mKey, false, null, null, 0, 0, emptyList())
                                }
                                val detailed = JSONObject(res.body?.string() ?: "{}").optJSONObject("manga")
                                    ?: return@runCatching CheckedResult(mKey, false, null, null, 0, 0, emptyList())

                                val chapters = detailed.optJSONArray("chapters") ?: JSONArray()
                                if (chapters.length() == 0) {
                                    return@runCatching CheckedResult(mKey, false, null, null, 0, 0, emptyList())
                                }

                                // Preserve cover URLs if upstream details omits them
                                if (detailed.optString("coverUrl").isBlank() && manga.optString("coverUrl").isNotBlank()) {
                                    detailed.put("coverUrl", manga.optString("coverUrl"))
                                }
                                if (detailed.optString("largeCoverUrl").isBlank() && manga.optString("largeCoverUrl").isNotBlank()) {
                                    detailed.put("largeCoverUrl", manga.optString("largeCoverUrl"))
                                }

                                val knownArr = entry.optJSONArray("knownChapterIds") ?: JSONArray()
                                val knownSet = mutableSetOf<String>()
                                for (k in 0 until knownArr.length()) knownSet.add(knownArr.getString(k))
                                val readArr = entry.optJSONArray("readChapterIds") ?: JSONArray()
                                val readSet = mutableSetOf<String>()
                                for (r in 0 until readArr.length()) readSet.add(readArr.getString(r))

                                val perMangaUpdates = mutableListOf<JSONObject>()
                                if (knownSet.isNotEmpty()) {
                                    for (c in 0 until chapters.length()) {
                                        val ch = chapters.getJSONObject(c)
                                        val chId = ch.optString("id")
                                        if (chId !in knownSet && chId !in readSet) {
                                            perMangaUpdates.add(JSONObject().apply {
                                                put("id", "$mKey::$chId")
                                                put("mangaKey", mKey)
                                                put("manga", detailed)
                                                put("chapter", ch)
                                                put("discoveredAt", System.currentTimeMillis())
                                            })
                                        }
                                    }
                                }
                                val nextKnown = JSONArray()
                                var unread = 0
                                for (c in 0 until chapters.length()) {
                                    val cid = chapters.getJSONObject(c).optString("id")
                                    nextKnown.put(cid)
                                    if (cid !in readSet) unread++
                                }
                                CheckedResult(mKey, true, detailed, nextKnown, chapters.length(), unread, perMangaUpdates)
                            }
                        }.getOrElse {
                            CheckedResult(mKey, false, null, null, 0, 0, emptyList())
                        }
                    }
                }
            }.awaitAll().filterNotNull()
        }
        for (r in results) checkedMap[r.key] = r

        // Re-read CURRENT library under storageMutex so migrations performed while checking updates are NEVER overwritten
        return storageMutex.withLock {
            val currentLib = JSONArray(readFileText("library.json", "[]"))
            val currentUpdates = JSONArray(readFileText("updates.json", "[]"))
            val newUpdates = mutableListOf<JSONObject>()
            val failedKeys = JSONArray()
            val okKeys = JSONArray()
            val now = System.currentTimeMillis()

            for (i in 0 until currentLib.length()) {
                val entry = currentLib.getJSONObject(i)
                val key = entry.optString("key")
                val checked = checkedMap[key] ?: continue
                if (!checked.ok || checked.detailedManga == null || checked.nextKnown == null) {
                    failedKeys.put(key)
                    continue
                }
                okKeys.put(key)
                entry.put("manga", checked.detailedManga)
                entry.put("knownChapterIds", checked.nextKnown)
                entry.put("totalChapters", checked.totalChapters)
                entry.put("unreadCount", checked.unreadCount)
                entry.put("lastCheckedAt", now)
                newUpdates.addAll(checked.updatesForManga)
            }

            val combined = JSONArray()
            newUpdates.forEach { combined.put(it) }
            val existingIds = newUpdates.map { it.optString("id") }.toSet()
            for (i in 0 until currentUpdates.length()) {
                if (combined.length() >= 150) break
                val cur = currentUpdates.getJSONObject(i)
                if (cur.optString("id") !in existingIds) combined.put(cur)
            }
            writeFileText("library.json", currentLib.toString())
            writeFileText("updates.json", combined.toString())
            JSONObject()
                .put("updates", combined)
                .put("library", currentLib)
                .put("newCount", newUpdates.size)
                .put("failedKeys", failedKeys)
                .put("okKeys", okKeys)
                .toString()
        }
    }

    private fun downloadChapterRpc(payload: JSONObject): JSONObject {
        val source = payload.getString("source")
        val mangaId = payload.getString("mangaId")
        val mangaTitle = payload.getString("mangaTitle")
        val coverUrl = payload.optString("coverUrl", "")
        val chapter = payload.getJSONObject("chapter")
        val chId = chapter.getString("id")
        val chNum = chapter.optDouble("number", 0.0)
        val chTitle = chapter.optString("title", "")
        val key = "$source::$mangaId::$chId"
        val engineUrl = "http://127.0.0.1:${AndroidKomaEngine.port}"

        val pagesReq = Request.Builder()
            .url("$engineUrl/api/sources/${Uri.encode(source)}/pages")
            .post(JSONObject().put("chapter", chapter).toString().toRequestBody("application/json".toMediaType()))
            .build()
        val pages = http.newCall(pagesReq).execute().use { res ->
            if (!res.isSuccessful) error("Failed to fetch pages (${res.code})")
            JSONObject(res.body?.string() ?: "{}").optJSONArray("pages") ?: JSONArray()
        }
        if (pages.length() == 0) error("Chapter has 0 pages")

        val safeDir = File(downloadsDir, sanitizeName("${source}_$mangaId")).apply { mkdirs() }
        val cbzFile = File(safeDir, sanitizeName("ch_${chNum}_${chId.take(12)}.cbz"))
        ZipOutputStream(FileOutputStream(cbzFile)).use { zos ->
            for (i in 0 until pages.length()) {
                val p = pages.getJSONObject(i)
                val targetUrl = p.optString("resolvedUrl").ifBlank { p.optString("url") }
                val imgUrl = "$engineUrl/api/image?source=${Uri.encode(source)}&url=${Uri.encode(targetUrl)}"
                val bytes = http.newCall(Request.Builder().url(imgUrl).build()).execute().use { r ->
                    if (!r.isSuccessful) error("Failed page ${i + 1} (${r.code})")
                    r.body?.bytes() ?: ByteArray(0)
                }
                zos.putNextEntry(ZipEntry("%04d.jpg".format(i + 1)))
                zos.write(bytes)
                zos.closeEntry()

                notifyListeners("downloadProgress", JSObject().apply {
                    put("key", key)
                    put("done", i + 1)
                    put("total", pages.length())
                })
            }
        }

        val record = JSONObject().apply {
            put("key", key)
            put("source", source)
            put("mangaId", mangaId)
            put("mangaTitle", mangaTitle)
            if (coverUrl.isNotBlank()) put("coverUrl", coverUrl)
            put("chapterId", chId)
            put("chapterNumber", chNum)
            put("chapterTitle", chTitle)
            put("cbzPath", cbzFile.absolutePath)
            put("pageCount", pages.length())
            put("sizeBytes", cbzFile.length())
            put("downloadedAt", System.currentTimeMillis())
        }
        val arr = readDownloadsJson()
        val out = JSONArray().put(record)
        for (i in 0 until arr.length()) {
            val cur = arr.getJSONObject(i)
            if (cur.optString("key") != key) out.put(cur)
        }
        writeFileText("downloads.json", out.toString(2))
        return record
    }

    private fun readDownloadsJson(): JSONArray {
        val arr = JSONArray(readFileText("downloads.json", "[]"))
        val out = JSONArray()
        for (i in 0 until arr.length()) {
            val cur = arr.getJSONObject(i)
            if (File(cur.optString("cbzPath")).exists()) out.put(cur)
        }
        return out
    }

    private fun recordStatsRpc(args: JSONObject): String {
        val cur = JSONObject(readFileText("stats.json", DEFAULT_STATS))
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
        cur.put("pagesRead", cur.optInt("pagesRead", 0) + args.optInt("pagesDelta", 0))
        cur.put("readingMinutes", cur.optInt("readingMinutes", 0) + args.optInt("minutesDelta", 0))
        if (args.optBoolean("chapterCompleted", false)) {
            cur.put("chaptersCompleted", cur.optInt("chaptersCompleted", 0) + 1)
        }
        val days = cur.optJSONArray("activeDays") ?: JSONArray()
        var hasToday = false
        for (i in 0 until days.length()) if (days.getString(i) == today) hasToday = true
        if (!hasToday) days.put(today)
        cur.put("activeDays", days)
        val genres = cur.optJSONObject("genreCounts") ?: JSONObject()
        args.optJSONArray("tags")?.let { tags ->
            for (i in 0 until tags.length()) {
                val t = tags.optString(i).trim()
                if (t.isNotBlank()) genres.put(t, genres.optInt(t, 0) + 1)
            }
        }
        cur.put("genreCounts", genres)
        writeFileText("stats.json", cur.toString(2))
        return cur.toString()
    }

    private fun stripTitleNoise(raw: String): String =
        raw.replace(Regex("\\s*\\([^)]*\\)\\s*"), " ")
            .replace(Regex("\\s*\\[[^\\]]*]\\s*"), " ")
            .replace(Regex("\\s*\\{[^}]*}\\s*"), " ")
            .replace(Regex("\\s{2,}"), " ")
            .replace(Regex("[\\s\\-:|·]+$"), "")
            .trim()

    private fun buildTitleCandidates(title: String, altTitle: String?): List<String> {
        val seen = mutableSetOf<String>()
        val out = mutableListOf<String>()
        fun add(s: String) {
            val c = s.trim()
            if (c.length >= 2 && seen.add(c.lowercase())) out.add(c)
        }
        add(stripTitleNoise(title))
        add(title)
        if (!altTitle.isNullOrBlank()) {
            for (part in altTitle.split(Regex("[·/|;\\n]+"))) add(stripTitleNoise(part))
        }
        return out.take(5)
    }

    private fun anilistGql(query: String, variables: JSONObject, token: String? = null): JSONObject? {
        val body = JSONObject().put("query", query).put("variables", variables).toString()
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder().url("https://graphql.anilist.co").post(body)
            .header("Accept", "application/json")
        if (!token.isNullOrBlank()) req.header("Authorization", "Bearer $token")
        return runCatching {
            http.newCall(req.build()).execute().use { res ->
                if (!res.isSuccessful) null
                else JSONObject(res.body?.string() ?: "{}").optJSONObject("data")
            }
        }.getOrNull()
    }

    private fun fetchAniListMetadata(title: String, altTitle: String?): JSONObject? {
        val key = "${title.trim().lowercase()}|${(altTitle ?: "").trim().lowercase()}"
        if (title.isBlank()) return null
        if (metadataCache.containsKey(key)) return metadataCache[key]

        val query = """
            query (${'$'}search: String) {
              Page(page: 1, perPage: 5) {
                media(search: ${'$'}search, type: MANGA, sort: SEARCH_MATCH) {
                  id format siteUrl title { english romaji }
                  description(asHtml: false) genres
                  bannerImage coverImage { extraLarge large }
                  averageScore popularity chapters status
                  relations { edges { relationType node { id format title { english romaji } coverImage { large } } } }
                  recommendations(perPage: 8, sort: RATING_DESC) {
                    nodes { mediaRecommendation { id averageScore title { english romaji } coverImage { large } } }
                  }
                }
              }
            }
        """.trimIndent()

        var matched: JSONObject? = null
        var hadNetwork = false
        for (term in buildTitleCandidates(title, altTitle)) {
            val data = anilistGql(query, JSONObject().put("search", term)) ?: continue
            hadNetwork = true
            val arr = data.optJSONObject("Page")?.optJSONArray("media") ?: continue
            if (arr.length() == 0) continue
            val items = (0 until arr.length()).map { arr.getJSONObject(it) }
            matched = items.sortedWith(
                compareBy<JSONObject> { if (it.optString("format") == "NOVEL") 1 else 0 }
                    .thenByDescending { m ->
                        val nodes = m.optJSONObject("recommendations")?.optJSONArray("nodes") ?: return@thenByDescending 0
                        (0 until nodes.length()).count { nodes.getJSONObject(it).optJSONObject("mediaRecommendation") != null }
                    }
                    .thenByDescending { it.optInt("popularity", 0) },
            ).firstOrNull()
            if (matched != null) break
        }
        if (matched == null) {
            if (hadNetwork) metadataCache[key] = null
            return null
        }

        val rels = JSONArray()
        matched.optJSONObject("relations")?.optJSONArray("edges")?.let { edges ->
            for (i in 0 until minOf(edges.length(), 8)) {
                val e = edges.getJSONObject(i)
                val node = e.optJSONObject("node") ?: continue
                val t = node.optJSONObject("title")
                rels.put(JSONObject().apply {
                    put("id", node.getInt("id"))
                    put("title", t?.optString("english")?.ifBlank { null } ?: t?.optString("romaji") ?: "Related")
                    put("relationType", e.optString("relationType").replace('_', ' '))
                    put("format", node.optString("format"))
                    node.optJSONObject("coverImage")?.optString("large")?.takeIf { it.isNotBlank() }?.let { put("cover", it) }
                })
            }
        }
        val recs = JSONArray()
        matched.optJSONObject("recommendations")?.optJSONArray("nodes")?.let { nodes ->
            for (i in 0 until nodes.length()) {
                val rec = nodes.getJSONObject(i).optJSONObject("mediaRecommendation") ?: continue
                val t = rec.optJSONObject("title")
                recs.put(JSONObject().apply {
                    put("id", rec.getInt("id"))
                    put("title", t?.optString("english")?.ifBlank { null } ?: t?.optString("romaji") ?: "Recommended")
                    rec.optJSONObject("coverImage")?.optString("large")?.takeIf { it.isNotBlank() }?.let { put("cover", it) }
                    if (rec.has("averageScore") && !rec.isNull("averageScore")) put("score", rec.getInt("averageScore"))
                })
            }
        }
        val tObj = matched.optJSONObject("title")
        val info = JSONObject().apply {
            put("id", matched.getInt("id"))
            put("title", tObj?.optString("english")?.ifBlank { null } ?: tObj?.optString("romaji") ?: title)
            matched.optString("description").takeIf { it.isNotBlank() }?.let { put("description", it) }
            matched.optJSONArray("genres")?.let { put("genres", it) }
            matched.optString("bannerImage").takeIf { it.isNotBlank() }?.let { put("bannerImage", it) }
            val cov = matched.optJSONObject("coverImage")
            (cov?.optString("extraLarge")?.ifBlank { null } ?: cov?.optString("large"))?.let { put("coverImage", it) }
            if (matched.has("averageScore") && !matched.isNull("averageScore")) put("averageScore", matched.getInt("averageScore"))
            if (matched.has("popularity") && !matched.isNull("popularity")) put("popularity", matched.getInt("popularity"))
            if (matched.has("chapters") && !matched.isNull("chapters")) put("chapters", matched.getInt("chapters"))
            matched.optString("status").takeIf { it.isNotBlank() }?.let { put("status", it) }
            matched.optString("siteUrl").takeIf { it.isNotBlank() }?.let { put("siteUrl", it) }
            put("relations", rels)
            put("recommendations", recs)
        }
        metadataCache[key] = info
        return info
    }

    private fun trackerPublicConfig(): JSONObject = JSONObject(readFileText("tracker.json", "{}"))

    private fun setAniListTokenRpc(token: String): String {
        val clean = token.trim()
        if (clean.isEmpty()) {
            writeFileText("tracker.json", "{}")
            return "{}"
        }
        val data = anilistGql("query { Viewer { id name avatar { medium } } }", JSONObject(), clean)
        val viewer = data?.optJSONObject("Viewer") ?: error("Invalid AniList access token")
        val cfg = JSONObject().apply {
            put("anilistToken", clean)
            put("anilistUser", JSONObject().apply {
                put("id", viewer.getInt("id"))
                put("name", viewer.getString("name"))
                viewer.optJSONObject("avatar")?.optString("medium")?.let { put("avatar", it) }
            })
        }
        writeFileText("tracker.json", cfg.toString(2))
        return cfg.toString()
    }

    private fun syncAniListProgressRpc(mangaTitle: String, chapterNumber: Int): String {
        val cfg = trackerPublicConfig()
        val token = cfg.optString("anilistToken", "")
        if (token.isBlank() || chapterNumber <= 0) return JSONObject().put("synced", false).toString()
        val meta = fetchAniListMetadata(mangaTitle, null) ?: return JSONObject().put("synced", false).toString()
        val mut = """
            mutation (${'$'}mediaId: Int, ${'$'}progress: Int, ${'$'}status: MediaListStatus) {
              SaveMediaListEntry(mediaId: ${'$'}mediaId, progress: ${'$'}progress, status: ${'$'}status) { id progress status }
            }
        """.trimIndent()
        val status = if (meta.has("chapters") && chapterNumber >= meta.optInt("chapters", Int.MAX_VALUE)) "COMPLETED" else "CURRENT"
        val res = anilistGql(mut, JSONObject().put("mediaId", meta.getInt("id")).put("progress", chapterNumber).put("status", status), token)
        val entry = res?.optJSONObject("SaveMediaListEntry")
        return JSONObject().put("synced", entry != null).apply {
            if (entry != null) put("progress", entry.optInt("progress"))
        }.toString()
    }

    private fun getAniListListsRpc(): String {
        val cfg = trackerPublicConfig()
        val token = cfg.optString("anilistToken", "")
        val userId = cfg.optJSONObject("anilistUser")?.optInt("id", 0) ?: 0
        if (token.isBlank() || userId <= 0) return "[]"
        val query = """
            query (${'$'}userId: Int) {
              MediaListCollection(userId: ${'$'}userId, type: MANGA) {
                lists { entries { progress status media { id chapters title { english romaji } coverImage { large } } } }
              }
            }
        """.trimIndent()
        val data = anilistGql(query, JSONObject().put("userId", userId), token) ?: return "[]"
        val lists = data.optJSONObject("MediaListCollection")?.optJSONArray("lists") ?: return "[]"
        val out = JSONArray()
        for (i in 0 until lists.length()) {
            val entries = lists.getJSONObject(i).optJSONArray("entries") ?: continue
            for (j in 0 until entries.length()) {
                val e = entries.getJSONObject(j)
                val m = e.optJSONObject("media") ?: continue
                val t = m.optJSONObject("title")
                out.put(JSONObject().apply {
                    put("id", m.getInt("id"))
                    put("title", t?.optString("english")?.ifBlank { null } ?: t?.optString("romaji") ?: "Unknown")
                    put("progress", e.optInt("progress", 0))
                    if (m.has("chapters") && !m.isNull("chapters")) put("totalChapters", m.getInt("chapters"))
                    m.optJSONObject("coverImage")?.optString("large")?.let { put("cover", it) }
                    put("status", e.optString("status", "CURRENT"))
                })
            }
        }
        return out.toString()
    }

    private fun ensureDefaultCategories(): String {
        val file = File(dataDir, "categories.json")
        if (file.exists()) return file.readText()
        writeFileText("categories.json", DEFAULT_CATEGORIES)
        return DEFAULT_CATEGORIES
    }

    private fun mergeSettings(): JSONObject {
        val def = JSONObject(DEFAULT_SETTINGS)
        val file = File(dataDir, "settings.json")
        if (!file.exists()) return def
        return runCatching {
            val saved = JSONObject(file.readText())
            for (k in saved.keys()) def.put(k, saved.get(k))
            def
        }.getOrDefault(def)
    }

    private fun readFileText(name: String, fallback: String): String {
        val f = File(dataDir, name)
        return if (f.exists()) runCatching { f.readText() }.getOrDefault(fallback) else fallback
    }

    private fun writeFileText(name: String, content: String) {
        val target = File(dataDir, name)
        val tmp = File(dataDir, "$name.tmp")
        tmp.writeText(content)
        if (!tmp.renameTo(target)) {
            target.writeText(content)
            tmp.delete()
        }
    }

    private fun getDisplayName(uri: Uri): String? {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (idx >= 0) return cursor.getString(idx)
            }
        }
        return uri.lastPathSegment
    }

    private fun sha256(s: String): String =
        MessageDigest.getInstance("SHA-256").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

    private fun sanitizeName(s: String): String =
        s.replace(Regex("[^a-zA-Z0-9._-]"), "_").take(80)

    private fun isImageName(n: String): Boolean {
        val l = n.lowercase()
        return l.endsWith(".jpg") || l.endsWith(".jpeg") || l.endsWith(".png") || l.endsWith(".webp") || l.endsWith(".gif")
    }

    private fun naturalCompare(a: String, b: String): Int = a.compareTo(b, ignoreCase = true)

    companion object {
        private val DEFAULT_CATEGORIES = """
            [
              {"id":"reading","name":"Reading","order":0},
              {"id":"favorites","name":"Favorites","order":1},
              {"id":"plan","name":"Plan to Read","order":2},
              {"id":"completed","name":"Completed","order":3}
            ]
        """.trimIndent()

        private val DEFAULT_STATS = """
            {"chaptersCompleted":0,"pagesRead":0,"readingMinutes":0,"activeDays":[],"genreCounts":{}}
        """.trimIndent()

        private val DEFAULT_SETTINGS = """
            {
              "preferredLanguages":["en","fr","ar"],
              "uiLanguage":"en",
              "uiTheme":"oled",
              "accentColor":"#FFFFFF",
              "showNsfw":false,
              "pinnedSources":["MANGABALL_EN","MANGADEX","WEEBCENTRAL","MANGAPILL","MANGAREAD","LELMANGA","TEAMXNOVEL"],
              "defaultReaderMode":"webtoon",
              "defaultFitMode":"width",
              "mangaReaderPrefs":{},
              "autoBingeNextChapter":false,
              "brightness":100,
              "contrast":100,
              "warmth":0,
              "oledInk":false,
              "oledTrueBlack":true,
              "ambientGlow":true,
              "preloadCount":4,
              "chapterDupMode":"dedupe",
              "mangaDupPrefs":{},
              "autoScrollSpeed":2,
              "discordRpc":false,
              "discordClientId":"",
              "autoCheckUpdates":true,
              "githubRepo":"nourddinachi20-rgb/KOMA",
              "hasCompletedTutorial":false,
              "hasSeenWelcome":false,
              "lastSeenVersion":"",
              "pendingWhatsNewNotes":"",
              "syncServerUrl":"",
              "syncUsername":"",
              "syncAuthHash":"",
              "syncKeyJwk":"",
              "deletedLibraryKeys":{},
              "persistedFailedKeys":{}
            }
        """.trimIndent()
    }
}

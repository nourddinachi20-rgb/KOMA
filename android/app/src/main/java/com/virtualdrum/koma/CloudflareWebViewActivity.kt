package com.virtualdrum.koma

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import okhttp3.Cookie
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

class CloudflareWebViewActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private val handler = Handler(Looper.getMainLooper())
    private var targetUrl: String = ""
    private var finished = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        targetUrl = intent.getStringExtra("url") ?: "https://mangadex.org"
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.BLACK)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }

        val topBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(36, 72, 36, 24)
            setBackgroundColor(Color.parseColor("#0A0A0E"))
        }

        val title = TextView(this).apply {
            text = "Verify Access · Solve Check & Tap Done"
            setTextColor(Color.WHITE)
            textSize = 13f
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }

        val doneBtn = Button(this).apply {
            text = "Done"
            setTextColor(Color.BLACK)
            setBackgroundColor(Color.WHITE)
            setOnClickListener { completeChallenge(true) }
        }

        topBar.addView(title)
        topBar.addView(doneBtn)

        val container = FrameLayout(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f,
            )
        }

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    checkClearance(url ?: targetUrl)
                }
            }
        }
        container.addView(webView)
        root.addView(topBar)
        root.addView(container)
        setContentView(root)

        webView.loadUrl(targetUrl)
        schedulePoll()
    }

    private fun schedulePoll() {
        if (finished) return
        handler.postDelayed({
            if (!finished) {
                checkClearance(webView.url ?: targetUrl)
                schedulePoll()
            }
        }, 900)
    }

    private fun checkClearance(currentUrl: String) {
        val rawCookies = CookieManager.getInstance().getCookie(currentUrl) ?: return
        if (rawCookies.contains("cf_clearance=")) {
            completeChallenge(true)
        }
    }

    private fun completeChallenge(ok: Boolean) {
        if (finished) return
        finished = true
        handler.removeCallbacksAndMessages(null)
        val currentUrl = webView.url ?: targetUrl
        val rawCookies = CookieManager.getInstance().getCookie(currentUrl) ?: ""
        val ua = webView.settings.userAgentString ?: ""
        val host = currentUrl.toHttpUrlOrNull()?.host ?: targetUrl.toHttpUrlOrNull()?.host ?: ""

        if (ok && host.isNotBlank() && rawCookies.isNotBlank()) {
            val parsed = rawCookies.split(";").mapNotNull { part ->
                val idx = part.indexOf('=')
                if (idx <= 0) null
                else {
                    val k = part.substring(0, idx).trim()
                    val v = part.substring(idx + 1).trim()
                    runCatching {
                        Cookie.Builder()
                            .name(k)
                            .value(v)
                            .domain(host.removePrefix("www."))
                            .path("/")
                            .expiresAt(System.currentTimeMillis() + 86_400_000L * 7)
                            .build()
                    }.getOrNull()
                }
            }
            com.noctis.engine.NoctisMangaLoaderContext.setHostCookies(host, parsed, ua)
            setResult(Activity.RESULT_OK, Intent().putExtra("injected", parsed.size))
        } else {
            setResult(Activity.RESULT_CANCELED)
        }
        finish()
    }

    override fun onDestroy() {
        finished = true
        handler.removeCallbacksAndMessages(null)
        runCatching { webView.destroy() }
        super.onDestroy()
    }
}

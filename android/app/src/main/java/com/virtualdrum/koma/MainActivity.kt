package com.virtualdrum.koma

import android.graphics.Color
import android.os.Bundle
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import com.getcapacitor.BridgeActivity
import com.noctis.engine.AndroidKomaEngine
import kotlin.math.ceil

class MainActivity : BridgeActivity() {
    companion object {
        @Volatile
        var safeTopDp: Int = 0
        @Volatile
        var safeBottomDp: Int = 0
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(KomaNativePlugin::class.java)
        super.onCreate(savedInstanceState)

        // True OLED #000000 edge-to-edge appearance on phones & tablets
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        ViewCompat.setOnApplyWindowInsetsListener(window.decorView) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val density = resources.displayMetrics.density.coerceAtLeast(1f)
            val topDp = ceil((bars.top / density).toDouble()).toInt()
            val bottomDp = ceil((bars.bottom / density).toDouble()).toInt()
            if (topDp != safeTopDp || bottomDp != safeBottomDp) {
                safeTopDp = topDp
                safeBottomDp = bottomDp
                bridge?.webView?.post {
                    bridge?.webView?.evaluateJavascript(
                        "document.documentElement.style.setProperty('--koma-safe-top','${topDp}px');" +
                            "document.documentElement.style.setProperty('--koma-safe-bottom','${bottomDp}px');",
                        null
                    )
                }
            }
            ViewCompat.onApplyWindowInsets(view, insets)
        }
    }

    override fun onDestroy() {
        AndroidKomaEngine.stop()
        super.onDestroy()
    }
}

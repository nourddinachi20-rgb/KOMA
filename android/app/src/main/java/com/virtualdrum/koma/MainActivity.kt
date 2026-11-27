package com.virtualdrum.koma

import android.graphics.Color
import android.os.Bundle
import androidx.core.view.WindowCompat
import com.getcapacitor.BridgeActivity
import com.noctis.engine.AndroidKomaEngine

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(KomaNativePlugin::class.java)
        super.onCreate(savedInstanceState)

        // True OLED #000000 edge-to-edge appearance on phones & tablets
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
    }

    override fun onDestroy() {
        AndroidKomaEngine.stop()
        super.onDestroy()
    }
}

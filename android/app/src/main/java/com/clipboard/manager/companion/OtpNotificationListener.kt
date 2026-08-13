package com.clipboard.manager.companion

import android.app.Notification
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Parcelable
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.util.concurrent.Executors

class OtpNotificationListener : NotificationListenerService() {
    private val executor = Executors.newSingleThreadExecutor()

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val safeNotification = sbn ?: return
        val store = SecureCredentialsStore(applicationContext)
        if (!store.isOtpEnabled()) return
        val credentials = store.load() ?: return
        if (safeNotification.packageName == packageName) return

        val notification = safeNotification.notification
        val appLabel = appLabel(safeNotification.packageName)
        if (!OtpExtractor.shouldInspectNotification(safeNotification.packageName, appLabel, notification.category)) return

        val extras = notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
        val messages = if (Build.VERSION.SDK_INT >= 33) {
            extras.getParcelableArray(Notification.EXTRA_MESSAGES, Parcelable::class.java)
        } else {
            @Suppress("DEPRECATION")
            extras.getParcelableArray(Notification.EXTRA_MESSAGES)
        }
            ?.joinToString(" ") { item ->
                val bundle = item as? Bundle
                bundle?.getCharSequence("text")?.toString().orEmpty()
            }
            .orEmpty()
        val code = OtpExtractor.extract(listOf(title, text, bigText, messages).joinToString(" ")) ?: return
        if (!store.reserveOtp(code)) return

        executor.execute {
            val success = try {
                ApiClient().sendOtp(credentials, code)
                true
            } catch (_: Exception) {
                false
            }
            store.recordOtpResult(success)
        }
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun appLabel(sourcePackage: String): String? = try {
        val info = packageManager.getApplicationInfo(sourcePackage, 0)
        packageManager.getApplicationLabel(info).toString()
    } catch (_: PackageManager.NameNotFoundException) {
        null
    }
}

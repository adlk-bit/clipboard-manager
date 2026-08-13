package com.clipboard.manager.companion

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import java.security.MessageDigest
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class DeviceCredentials(
    val serverUrl: String,
    val deviceId: String,
    val deviceSecret: String,
    val deviceName: String,
)

class SecureCredentialsStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun save(credentials: DeviceCredentials) {
        val payload = JSONObject()
            .put("serverUrl", credentials.serverUrl)
            .put("deviceId", credentials.deviceId)
            .put("deviceSecret", credentials.deviceSecret)
            .put("deviceName", credentials.deviceName)
            .toString()
            .toByteArray(StandardCharsets.UTF_8)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val encrypted = cipher.doFinal(payload)
        preferences.edit()
            .putString(KEY_CREDENTIALS, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .putString(KEY_IV, Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .apply()
    }

    fun load(): DeviceCredentials? {
        val encryptedValue = preferences.getString(KEY_CREDENTIALS, null) ?: return null
        val ivValue = preferences.getString(KEY_IV, null) ?: return null
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                getOrCreateKey(),
                GCMParameterSpec(128, Base64.decode(ivValue, Base64.NO_WRAP)),
            )
            val json = JSONObject(
                String(cipher.doFinal(Base64.decode(encryptedValue, Base64.NO_WRAP)), StandardCharsets.UTF_8),
            )
            val credentials = DeviceCredentials(
                serverUrl = json.getString("serverUrl"),
                deviceId = json.getString("deviceId"),
                deviceSecret = json.getString("deviceSecret"),
                deviceName = json.optString("deviceName", "Android"),
            )
            if (!isSafeCredentials(credentials)) null else credentials
        } catch (_: Exception) {
            clearCredentials()
            null
        }
    }

    fun clearCredentials() {
        preferences.edit()
            .remove(KEY_CREDENTIALS)
            .remove(KEY_IV)
            .putBoolean(KEY_OTP_ENABLED, false)
            .apply()
    }

    fun isOtpEnabled(): Boolean = preferences.getBoolean(KEY_OTP_ENABLED, false)

    fun setOtpEnabled(enabled: Boolean) {
        preferences.edit().putBoolean(KEY_OTP_ENABLED, enabled).apply()
    }

    @Synchronized
    fun reserveOtp(code: String, now: Long = System.currentTimeMillis()): Boolean {
        val hash = MessageDigest.getInstance("SHA-256")
            .digest(code.toByteArray(StandardCharsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        val previousHash = preferences.getString(KEY_LAST_OTP_HASH, null)
        val previousTime = preferences.getLong(KEY_LAST_OTP_ATTEMPT, 0L)
        if (previousHash == hash && now - previousTime < OTP_DEDUPLICATION_MS) return false
        preferences.edit()
            .putString(KEY_LAST_OTP_HASH, hash)
            .putLong(KEY_LAST_OTP_ATTEMPT, now)
            .apply()
        return true
    }

    fun recordOtpResult(success: Boolean, now: Long = System.currentTimeMillis()) {
        preferences.edit()
            .putBoolean(KEY_LAST_OTP_SUCCESS, success)
            .putLong(KEY_LAST_OTP_RESULT, now)
            .apply()
    }

    fun lastOtpResult(): Pair<Boolean, Long>? {
        val timestamp = preferences.getLong(KEY_LAST_OTP_RESULT, 0L)
        if (timestamp <= 0L) return null
        return preferences.getBoolean(KEY_LAST_OTP_SUCCESS, false) to timestamp
    }

    private fun isSafeCredentials(credentials: DeviceCredentials): Boolean {
        val target = PairingUrlParser.parse("${credentials.serverUrl}/pair?token=${credentials.deviceSecret}")
        return target != null
            && credentials.deviceId.matches(Regex("^[a-fA-F0-9-]{16,64}$"))
            && credentials.deviceSecret.matches(Regex("^[A-Za-z0-9_-]{32,128}$"))
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return generator.generateKey()
    }

    companion object {
        private const val PREFERENCES_NAME = "secure_mobile_sync"
        private const val KEYSTORE_PROVIDER = "AndroidKeyStore"
        private const val KEY_ALIAS = "clipboard_manager_mobile_sync_v1"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val KEY_CREDENTIALS = "credentials"
        private const val KEY_IV = "credentials_iv"
        private const val KEY_OTP_ENABLED = "otp_enabled"
        private const val KEY_LAST_OTP_HASH = "last_otp_hash"
        private const val KEY_LAST_OTP_ATTEMPT = "last_otp_attempt"
        private const val KEY_LAST_OTP_SUCCESS = "last_otp_success"
        private const val KEY_LAST_OTP_RESULT = "last_otp_result"
        private const val OTP_DEDUPLICATION_MS = 60_000L
    }
}

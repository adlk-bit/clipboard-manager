package com.clipboard.manager.companion

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.nio.charset.StandardCharsets

data class ComputerClipboardState(val computerName: String, val text: String)

class ApiClient {
    fun pair(target: PairingTarget, deviceName: String): DeviceCredentials {
        val body = JSONObject()
            .put("token", target.token)
            .put("name", deviceName.take(40))
            .put("platform", "android")
            .toString()
        val response = request(target.pairingUrl, "POST", body, null)
        val json = JSONObject(response)
        return DeviceCredentials(
            serverUrl = target.serverUrl,
            deviceId = json.getString("deviceId"),
            deviceSecret = json.getString("deviceSecret"),
            deviceName = deviceName.take(40),
        )
    }

    fun getClipboard(credentials: DeviceCredentials): ComputerClipboardState {
        val response = request("${credentials.serverUrl}/api/state", "GET", null, credentials)
        val json = JSONObject(response)
        return ComputerClipboardState(
            computerName = json.optString("computerName", "Windows"),
            text = json.optString("text", "").take(MAX_TEXT_LENGTH),
        )
    }

    fun sendClipboard(credentials: DeviceCredentials, text: String) {
        require(text.length in 1..MAX_TEXT_LENGTH)
        val body = JSONObject().put("text", text).toString()
        request("${credentials.serverUrl}/api/clipboard", "POST", body, credentials)
    }

    fun sendOtp(credentials: DeviceCredentials, code: String) {
        require(code.matches(Regex("^[0-9]{6}$")))
        val body = JSONObject().put("code", code).toString()
        request("${credentials.serverUrl}/api/otp", "POST", body, credentials)
    }

    fun disconnect(credentials: DeviceCredentials) {
        request("${credentials.serverUrl}/api/device", "DELETE", null, credentials)
    }

    private fun request(
        rawUrl: String,
        method: String,
        body: String?,
        credentials: DeviceCredentials?,
    ): String {
        validateRequestUrl(rawUrl)
        val connection = URL(rawUrl).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = CONNECT_TIMEOUT_MS
            connection.readTimeout = READ_TIMEOUT_MS
            connection.instanceFollowRedirects = false
            connection.useCaches = false
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-store")
            credentials?.let {
                connection.setRequestProperty("Authorization", "Bearer ${it.deviceSecret}")
                connection.setRequestProperty("X-Device-Id", it.deviceId)
            }
            if (body != null) {
                val payload = body.toByteArray(StandardCharsets.UTF_8)
                connection.doOutput = true
                connection.setFixedLengthStreamingMode(payload.size)
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { it.write(payload) }
            }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.use(::readLimited) ?: ""
            if (status !in 200..299) {
                val message = try { JSONObject(response).optString("error") } catch (_: Exception) { response }
                throw IOException(message.ifBlank { "HTTP $status" })
            }
            return response
        } finally {
            connection.disconnect()
        }
    }

    private fun validateRequestUrl(rawUrl: String) {
        val uri = try { URI(rawUrl) } catch (error: Exception) { throw IOException("Invalid server URL", error) }
        if (!uri.scheme.equals("http", ignoreCase = true)
            || uri.port !in 1..65535
            || !PairingUrlParser.isPrivateIpv4(uri.host.orEmpty())
            || uri.userInfo != null
            || uri.fragment != null
        ) {
            throw IOException("Only private-network HTTP addresses are allowed")
        }
    }

    private fun readLimited(stream: java.io.InputStream): String {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(4_096)
        var total = 0
        while (true) {
            val count = stream.read(buffer)
            if (count < 0) break
            total += count
            if (total > MAX_RESPONSE_BYTES) throw IOException("Response is too large")
            output.write(buffer, 0, count)
        }
        return output.toString(StandardCharsets.UTF_8.name())
    }

    companion object {
        private const val CONNECT_TIMEOUT_MS = 5_000
        private const val READ_TIMEOUT_MS = 8_000
        private const val MAX_RESPONSE_BYTES = 64 * 1024
        const val MAX_TEXT_LENGTH = 10_000
    }
}

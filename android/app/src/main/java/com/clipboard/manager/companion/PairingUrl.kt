package com.clipboard.manager.companion

import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

data class PairingTarget(
    val pairingUrl: String,
    val serverUrl: String,
    val token: String,
)

object PairingUrlParser {
    private val tokenPattern = Regex("^[A-Za-z0-9_-]{32,128}$")

    fun parse(rawValue: String?): PairingTarget? {
        val raw = rawValue?.trim().orEmpty()
        if (raw.length !in 1..512) return null
        val uri = try { URI(raw) } catch (_: Exception) { return null }
        if (!uri.scheme.equals("http", ignoreCase = true)) return null
        if (uri.userInfo != null || uri.fragment != null || uri.path != "/pair") return null
        val host = uri.host ?: return null
        if (!isPrivateIpv4(host)) return null
        val port = uri.port
        if (port !in 1..65535) return null

        val parameters = parseQuery(uri.rawQuery ?: return null)
        val token = parameters["token"]?.singleOrNull() ?: return null
        if (!tokenPattern.matches(token)) return null

        return PairingTarget(
            pairingUrl = raw,
            serverUrl = "http://$host:$port",
            token = token,
        )
    }

    fun isPrivateIpv4(address: String): Boolean {
        val octets = address.split('.').map { it.toIntOrNull() ?: return false }
        if (octets.size != 4 || octets.any { it !in 0..255 }) return false
        return octets[0] == 10
            || (octets[0] == 172 && octets[1] in 16..31)
            || (octets[0] == 192 && octets[1] == 168)
            || (octets[0] == 169 && octets[1] == 254)
    }

    private fun parseQuery(rawQuery: String): Map<String, List<String>> {
        val result = mutableMapOf<String, MutableList<String>>()
        for (part in rawQuery.split('&')) {
            if (part.isBlank()) continue
            val pieces = part.split('=', limit = 2)
            val key = decode(pieces[0]) ?: continue
            val value = decode(pieces.getOrElse(1) { "" }) ?: continue
            result.getOrPut(key) { mutableListOf() }.add(value)
        }
        return result
    }

    private fun decode(value: String): String? = try {
        URLDecoder.decode(value, StandardCharsets.UTF_8.name())
    } catch (_: IllegalArgumentException) {
        null
    }
}

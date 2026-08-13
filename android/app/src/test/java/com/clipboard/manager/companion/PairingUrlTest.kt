package com.clipboard.manager.companion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PairingUrlTest {
    private val token = "abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678"

    @Test
    fun acceptsPrivateHttpPairingUrls() {
        val result = PairingUrlParser.parse("http://192.168.1.5:37241/pair?token=$token")
        assertNotNull(result)
        assertEquals("http://192.168.1.5:37241", result?.serverUrl)
        assertEquals(token, result?.token)
    }

    @Test
    fun rejectsPublicTlsMissingPortAndDuplicateTokens() {
        assertNull(PairingUrlParser.parse("http://8.8.8.8:37241/pair?token=$token"))
        assertNull(PairingUrlParser.parse("https://192.168.1.5:37241/pair?token=$token"))
        assertNull(PairingUrlParser.parse("http://192.168.1.5/pair?token=$token"))
        assertNull(PairingUrlParser.parse("http://192.168.1.5:37241/pair?token=$token&token=$token"))
    }

    @Test
    fun recognizesOnlyPrivateIpv4Ranges() {
        assertTrue(PairingUrlParser.isPrivateIpv4("10.0.0.1"))
        assertTrue(PairingUrlParser.isPrivateIpv4("172.31.4.9"))
        assertTrue(PairingUrlParser.isPrivateIpv4("192.168.0.2"))
        assertFalse(PairingUrlParser.isPrivateIpv4("172.32.0.1"))
        assertFalse(PairingUrlParser.isPrivateIpv4("127.0.0.1"))
    }
}

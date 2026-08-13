package com.clipboard.manager.companion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OtpExtractorTest {
    @Test
    fun extractsOneContextualSixDigitCode() {
        assertEquals("654321", OtpExtractor.extract("【示例】验证码 654321，5 分钟内有效，请勿泄露"))
        assertEquals("123456", OtpExtractor.extract("Your one-time verification code is 123456"))
    }

    @Test
    fun rejectsNumbersWithoutContextOrAmbiguousMessages() {
        assertNull(OtpExtractor.extract("快递尾号 123456 已送达"))
        assertNull(OtpExtractor.extract("验证码 123456，备用验证码 654321"))
        assertNull(OtpExtractor.extract("验证码 12345"))
    }

    @Test
    fun limitsNotificationSourcesToMessageApps() {
        assertTrue(OtpExtractor.shouldInspectNotification("com.google.android.apps.messaging", "Messages", null))
        assertTrue(OtpExtractor.shouldInspectNotification("vendor.sms", "短信", "msg"))
        assertFalse(OtpExtractor.shouldInspectNotification("com.example.mail", "Mail", "email"))
    }
}

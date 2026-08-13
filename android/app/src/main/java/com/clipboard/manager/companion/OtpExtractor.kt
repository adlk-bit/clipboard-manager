package com.clipboard.manager.companion

object OtpExtractor {
    private val codePattern = Regex("(?<![0-9])[0-9]{6}(?![0-9])")
    private val contextPattern = Regex(
        "验证码|校验码|动态码|一次性|登录|有效|勿泄露|verification\\s*code|security\\s*code|one[- ]time|passcode|otp|code\\s*(?:is|:)",
        RegexOption.IGNORE_CASE,
    )
    private val knownMessagePackages = setOf(
        "com.google.android.apps.messaging",
        "com.samsung.android.messaging",
        "com.android.mms",
        "com.android.messaging",
        "com.miui.mms",
        "com.coloros.mms",
        "com.oneplus.mms",
        "com.huawei.message",
        "com.huawei.mms",
        "com.vivo.mms",
        "com.meizu.mms",
    )
    private val messageLabelPattern = Regex("短信|信息|messages?|messaging", RegexOption.IGNORE_CASE)

    fun extract(text: String?): String? {
        val safeText = text?.take(4_000)?.trim().orEmpty()
        if (safeText.isEmpty() || !contextPattern.containsMatchIn(safeText)) return null
        val matches = codePattern.findAll(safeText).map { it.value }.distinct().take(2).toList()
        return matches.singleOrNull()
    }

    fun shouldInspectNotification(packageName: String, appLabel: String?, category: String?): Boolean {
        if (knownMessagePackages.contains(packageName)) return true
        return category == "msg" && messageLabelPattern.containsMatchIn(appLabel.orEmpty())
    }
}

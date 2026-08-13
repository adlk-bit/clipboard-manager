package com.clipboard.manager.companion

import android.app.AlertDialog
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CompoundButton
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import java.text.DateFormat
import java.util.Date
import java.util.concurrent.Executors

class MainActivity : android.app.Activity() {
    private lateinit var credentialsStore: SecureCredentialsStore
    private lateinit var statusText: TextView
    private lateinit var statusDot: View
    private lateinit var instructionText: TextView
    private lateinit var clipboardInput: EditText
    private lateinit var clipboardSection: LinearLayout
    private lateinit var otpSection: LinearLayout
    private lateinit var otpSwitch: Switch
    private lateinit var lastOtpText: TextView
    private lateinit var disconnectButton: Button
    private val executor = Executors.newSingleThreadExecutor()
    private val apiClient = ApiClient()
    private var suppressOtpSwitchCallback = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        credentialsStore = SecureCredentialsStore(applicationContext)
        setContentView(buildContentView())
        handlePairingIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handlePairingIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        renderState()
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun buildContentView(): View {
        val scroll = ScrollView(this).apply { setBackgroundColor(themeBackground()) }
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(24), dp(18), dp(30))
        }

        root.addView(TextView(this).apply {
            text = getString(R.string.hero_title)
            textSize = 28f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(primaryTextColor())
        })
        root.addView(TextView(this).apply {
            text = getString(R.string.hero_subtitle)
            textSize = 13f
            setTextColor(secondaryTextColor())
            setPadding(0, dp(4), 0, dp(18))
        })

        val statusCard = card()
        val statusRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        statusDot = View(this).apply {
            background = roundedBackground(Color.rgb(255, 159, 10), 10f)
            layoutParams = LinearLayout.LayoutParams(dp(10), dp(10)).apply { marginEnd = dp(10) }
        }
        statusText = TextView(this).apply { textSize = 15f; setTypeface(typeface, Typeface.BOLD); setTextColor(primaryTextColor()) }
        statusRow.addView(statusDot)
        statusRow.addView(statusText, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        statusCard.addView(statusRow)
        instructionText = TextView(this).apply {
            text = getString(R.string.scan_instruction)
            textSize = 12f
            setTextColor(secondaryTextColor())
            setLineSpacing(0f, 1.18f)
            setPadding(0, dp(10), 0, 0)
        }
        statusCard.addView(instructionText)
        root.addView(statusCard)

        clipboardSection = card().apply {
            addView(sectionTitle(R.string.clipboard_title))
            clipboardInput = EditText(this@MainActivity).apply {
                hint = getString(R.string.clipboard_input_hint)
                minLines = 4
                maxLines = 8
                gravity = Gravity.TOP
                setPadding(dp(12), dp(10), dp(12), dp(10))
                background = roundedBackground(inputBackgroundColor(), 12f, borderColor())
                setTextColor(primaryTextColor())
                setHintTextColor(secondaryTextColor())
            }
            addView(clipboardInput, spacedParams())
            addView(actionButton(R.string.read_phone_clipboard, secondary = true) { readPhoneClipboard() }, spacedParams())
            addView(actionButton(R.string.send_to_computer) { sendToComputer() }, spacedParams())
            addView(actionButton(R.string.get_from_computer, secondary = true) { getFromComputer() }, spacedParams())
        }
        root.addView(clipboardSection)

        otpSection = card().apply {
            addView(sectionTitle(R.string.verification_title))
            addView(TextView(this@MainActivity).apply {
                text = getString(R.string.verification_description)
                textSize = 12f
                setTextColor(secondaryTextColor())
                setLineSpacing(0f, 1.18f)
                setPadding(0, dp(7), 0, dp(9))
            })
            otpSwitch = Switch(this@MainActivity).apply {
                text = getString(R.string.verification_switch)
                textSize = 14f
                setTextColor(primaryTextColor())
                setOnCheckedChangeListener(::onOtpSwitchChanged)
            }
            addView(otpSwitch)
            addView(actionButton(R.string.open_notification_settings, secondary = true) { openNotificationSettings() }, spacedParams())
            lastOtpText = TextView(this@MainActivity).apply { textSize = 11f; setTextColor(secondaryTextColor()); setPadding(0, dp(9), 0, 0) }
            addView(lastOtpText)
            addView(TextView(this@MainActivity).apply {
                text = getString(R.string.privacy_note)
                textSize = 11f
                setTextColor(Color.rgb(186, 104, 0))
                setPadding(0, dp(12), 0, 0)
            })
        }
        root.addView(otpSection)

        disconnectButton = actionButton(R.string.disconnect_action, danger = true) { confirmDisconnect() }
        root.addView(disconnectButton, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)).apply { topMargin = dp(2) })
        scroll.addView(root)
        return scroll
    }

    private fun handlePairingIntent(intent: Intent?) {
        if (intent?.action != Intent.ACTION_VIEW || intent.data?.scheme != "clipboardmanager") return
        val encodedUrl = intent.data?.getQueryParameter("url")
        val target = PairingUrlParser.parse(encodedUrl)
        intent.data = null
        if (target == null) {
            toast(R.string.invalid_pairing_link)
            return
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.pairing_prompt_title)
            .setMessage(getString(R.string.pairing_prompt_message, target.serverUrl))
            .setNegativeButton(R.string.cancel_action, null)
            .setPositiveButton(R.string.pair_action) { _, _ -> pair(target) }
            .show()
    }

    private fun pair(target: PairingTarget) {
        statusText.text = getString(R.string.pairing_progress)
        executor.execute {
            try {
                val credentials = apiClient.pair(target, android.os.Build.MODEL.ifBlank { "Android" })
                credentialsStore.save(credentials)
                runOnUiThread { renderState(); toast(R.string.pairing_success) }
            } catch (error: Exception) {
                runOnUiThread { renderState(); toast(getString(R.string.pairing_failed, safeError(error))) }
            }
        }
    }

    private fun readPhoneClipboard() {
        val manager = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val text = manager.primaryClip?.getItemAt(0)?.coerceToText(this)?.toString().orEmpty()
        if (text.isEmpty()) toast(R.string.phone_clipboard_empty) else clipboardInput.setText(text.take(ApiClient.MAX_TEXT_LENGTH))
    }

    private fun sendToComputer() {
        val credentials = credentialsStore.load() ?: return toast(R.string.not_connected_error)
        val text = clipboardInput.text?.toString().orEmpty()
        if (text.length !in 1..ApiClient.MAX_TEXT_LENGTH) return toast(R.string.invalid_text)
        executor.execute {
            try {
                apiClient.sendClipboard(credentials, text)
                runOnUiThread { toast(R.string.clipboard_sent) }
            } catch (error: Exception) {
                runOnUiThread { toast(getString(R.string.request_failed, safeError(error))) }
            }
        }
    }

    private fun getFromComputer() {
        val credentials = credentialsStore.load() ?: return toast(R.string.not_connected_error)
        executor.execute {
            try {
                val state = apiClient.getClipboard(credentials)
                runOnUiThread {
                    if (state.text.isEmpty()) return@runOnUiThread toast(R.string.computer_clipboard_empty)
                    val manager = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    val clip = ClipData.newPlainText("Computer clipboard", state.text)
                    if (android.os.Build.VERSION.SDK_INT >= 33) {
                        clip.description.extras = android.os.PersistableBundle().apply {
                            putBoolean("android.content.extra.IS_SENSITIVE", true)
                        }
                    }
                    manager.setPrimaryClip(clip)
                    clipboardInput.setText(state.text)
                    statusText.text = getString(R.string.connected_to, state.computerName)
                    toast(R.string.clipboard_received)
                }
            } catch (error: Exception) {
                runOnUiThread { toast(getString(R.string.request_failed, safeError(error))) }
            }
        }
    }

    private fun onOtpSwitchChanged(button: CompoundButton, enabled: Boolean) {
        if (suppressOtpSwitchCallback) return
        if (enabled && !hasNotificationAccess()) {
            suppressOtpSwitchCallback = true
            button.isChecked = false
            suppressOtpSwitchCallback = false
            credentialsStore.setOtpEnabled(false)
            toast(R.string.notification_access_required)
            openNotificationSettings()
            return
        }
        credentialsStore.setOtpEnabled(enabled)
    }

    private fun hasNotificationAccess(): Boolean {
        val manager = getSystemService(NotificationManager::class.java)
        return manager.isNotificationListenerAccessGranted(ComponentName(this, OtpNotificationListener::class.java))
    }

    private fun openNotificationSettings() {
        try {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        } catch (_: ActivityNotFoundException) {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }
    }

    private fun confirmDisconnect() {
        val credentials = credentialsStore.load() ?: return
        AlertDialog.Builder(this)
            .setTitle(R.string.disconnect_title)
            .setMessage(R.string.disconnect_message)
            .setNegativeButton(R.string.cancel_action, null)
            .setPositiveButton(R.string.disconnect_action) { _, _ ->
                executor.execute {
                    try { apiClient.disconnect(credentials) } catch (_: Exception) {}
                    credentialsStore.clearCredentials()
                    runOnUiThread { renderState(); toast(R.string.disconnected) }
                }
            }
            .show()
    }

    private fun renderState() {
        val credentials = credentialsStore.load()
        val connected = credentials != null
        statusText.text = if (connected) getString(R.string.connected_to, credentials!!.serverUrl) else getString(R.string.status_disconnected)
        statusDot.background = roundedBackground(if (connected) Color.rgb(52, 199, 89) else Color.rgb(255, 159, 10), 10f)
        instructionText.visibility = if (connected) View.GONE else View.VISIBLE
        clipboardSection.visibility = if (connected) View.VISIBLE else View.GONE
        otpSection.visibility = if (connected) View.VISIBLE else View.GONE
        disconnectButton.visibility = if (connected) View.VISIBLE else View.GONE
        suppressOtpSwitchCallback = true
        otpSwitch.isChecked = connected && credentialsStore.isOtpEnabled() && hasNotificationAccess()
        if (!otpSwitch.isChecked && credentialsStore.isOtpEnabled()) credentialsStore.setOtpEnabled(false)
        suppressOtpSwitchCallback = false
        val otpResult = credentialsStore.lastOtpResult()
        lastOtpText.text = if (otpResult == null) getString(R.string.last_verification_never) else {
            val formatted = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(otpResult.second))
            getString(if (otpResult.first) R.string.last_verification_success else R.string.last_verification_failed, formatted)
        }
    }

    private fun card(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(16), dp(15), dp(16), dp(15))
        background = roundedBackground(cardBackgroundColor(), 18f, borderColor())
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(13) }
    }

    private fun sectionTitle(resource: Int): TextView = TextView(this).apply {
        text = getString(resource)
        textSize = 17f
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(primaryTextColor())
    }

    private fun actionButton(resource: Int, secondary: Boolean = false, danger: Boolean = false, onClick: () -> Unit): Button = Button(this).apply {
        text = getString(resource)
        isAllCaps = false
        textSize = 14f
        setTypeface(typeface, Typeface.BOLD)
        setTextColor(if (secondary) Color.rgb(0, 103, 206) else Color.WHITE)
        background = roundedBackground(
            when { danger -> Color.rgb(220, 53, 69); secondary -> Color.rgb(232, 242, 255); else -> Color.rgb(10, 132, 255) },
            12f,
        )
        setOnClickListener { onClick() }
    }

    private fun spacedParams() = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(9) }

    private fun roundedBackground(fill: Int, radius: Float, stroke: Int? = null) = android.graphics.drawable.GradientDrawable().apply {
        shape = android.graphics.drawable.GradientDrawable.RECTANGLE
        setColor(fill)
        cornerRadius = dp(radius.toInt()).toFloat()
        if (stroke != null) setStroke(dp(1), stroke)
    }

    private fun themeBackground() = if (isDark()) Color.rgb(0, 0, 0) else Color.rgb(242, 242, 247)
    private fun cardBackgroundColor() = if (isDark()) Color.rgb(28, 28, 30) else Color.WHITE
    private fun inputBackgroundColor() = if (isDark()) Color.rgb(44, 44, 46) else Color.rgb(247, 247, 250)
    private fun borderColor() = if (isDark()) Color.rgb(72, 72, 74) else Color.rgb(216, 216, 220)
    private fun primaryTextColor() = if (isDark()) Color.rgb(245, 245, 247) else Color.rgb(28, 28, 30)
    private fun secondaryTextColor() = if (isDark()) Color.rgb(152, 152, 157) else Color.rgb(99, 99, 102)
    private fun isDark() = (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun safeError(error: Exception) = error.message?.take(160).orEmpty().ifBlank { error.javaClass.simpleName }
    private fun toast(resource: Int) = Toast.makeText(this, resource, Toast.LENGTH_SHORT).show()
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()
}

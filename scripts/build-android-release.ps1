param(
    [string]$AndroidSdk = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $repoRoot "android"
$buildFile = Join-Path $androidRoot "app\build.gradle.kts"
$buildText = Get-Content -LiteralPath $buildFile -Raw
$versionMatch = [regex]::Match($buildText, 'versionName\s*=\s*"([^"]+)"')
if (-not $versionMatch.Success) {
    throw "Unable to read Android versionName from $buildFile"
}
$version = $versionMatch.Groups[1].Value

if ([string]::IsNullOrWhiteSpace($AndroidSdk)) {
    if (-not [string]::IsNullOrWhiteSpace($env:ANDROID_HOME)) {
        $AndroidSdk = $env:ANDROID_HOME
    } else {
        $AndroidSdk = Join-Path $repoRoot ".android-sdk"
    }
}
if (-not (Test-Path -LiteralPath $AndroidSdk -PathType Container)) {
    throw "Android SDK not found at $AndroidSdk. Pass -AndroidSdk or set ANDROID_HOME."
}

$keytoolCommand = Get-Command keytool.exe -ErrorAction SilentlyContinue
$keytoolCandidates = @()
if ($null -ne $keytoolCommand) {
    $keytoolCandidates += $keytoolCommand.Source
}
if (-not [string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
    $keytoolCandidates += Join-Path $env:JAVA_HOME "bin\keytool.exe"
}
$keytoolCandidates += Join-Path $env:ProgramFiles "Android\Android Studio\jbr\bin\keytool.exe"
$javaInstallRoot = Join-Path $env:ProgramFiles "Java"
if (Test-Path -LiteralPath $javaInstallRoot -PathType Container) {
    $javaInstallations = Get-ChildItem -LiteralPath $javaInstallRoot -Directory | Sort-Object Name -Descending
    foreach ($javaInstallation in $javaInstallations) {
        $keytoolCandidates += Join-Path $javaInstallation.FullName "bin\keytool.exe"
    }
}
$keytool = $keytoolCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($keytool)) {
    throw "keytool.exe was not found. Install JDK 17 or set JAVA_HOME."
}
$signingRoot = Join-Path $env:LOCALAPPDATA "ClipboardManager\android-signing"
$keystorePath = Join-Path $signingRoot "clipboard-manager-release.jks"
$secretPath = Join-Path $signingRoot "release-password.xml"
$keyAlias = "clipboard-manager"
New-Item -ItemType Directory -Path $signingRoot -Force | Out-Null

if ((Test-Path -LiteralPath $keystorePath) -xor (Test-Path -LiteralPath $secretPath)) {
    throw "Android signing state is incomplete at $signingRoot. Restore the matching key and password backup before releasing."
}

if (-not (Test-Path -LiteralPath $keystorePath)) {
    $randomBytes = New-Object byte[] 24
    $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $randomGenerator.GetBytes($randomBytes)
    } finally {
        $randomGenerator.Dispose()
    }
    $plainPassword = ([BitConverter]::ToString($randomBytes)).Replace("-", "")
    ConvertTo-SecureString $plainPassword -AsPlainText -Force | Export-Clixml -LiteralPath $secretPath
    & $keytool -genkeypair -v -keystore $keystorePath -storepass $plainPassword -keypass $plainPassword -alias $keyAlias -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Clipboard Manager"
    if ($LASTEXITCODE -ne 0) {
        throw "keytool failed with exit code $LASTEXITCODE"
    }
} else {
    $securePassword = Import-Clixml -LiteralPath $secretPath
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
}

$env:ANDROID_HOME = (Resolve-Path -LiteralPath $AndroidSdk).Path
$env:CLIPBOARD_MANAGER_ANDROID_KEYSTORE = $keystorePath
$env:CLIPBOARD_MANAGER_ANDROID_STORE_PASSWORD = $plainPassword
$env:CLIPBOARD_MANAGER_ANDROID_KEY_ALIAS = $keyAlias
$env:CLIPBOARD_MANAGER_ANDROID_KEY_PASSWORD = $plainPassword

Push-Location $androidRoot
try {
    & .\gradlew.bat clean testDebugUnitTest lintRelease assembleRelease --warning-mode all
    if ($LASTEXITCODE -ne 0) {
        throw "Android release build failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
    Remove-Item Env:CLIPBOARD_MANAGER_ANDROID_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:CLIPBOARD_MANAGER_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
    $plainPassword = $null
}

$sourceApk = Join-Path $androidRoot "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path -LiteralPath $sourceApk -PathType Leaf)) {
    throw "Signed release APK was not produced at $sourceApk"
}
$distRoot = Join-Path $repoRoot "dist"
New-Item -ItemType Directory -Path $distRoot -Force | Out-Null
$outputApk = Join-Path $distRoot "ClipboardManager-Android-$version.apk"
Copy-Item -LiteralPath $sourceApk -Destination $outputApk -Force
Write-Output $outputApk

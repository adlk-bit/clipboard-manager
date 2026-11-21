!macro customInstall
  ; Full paths to the Windows tool and a fixed list of our installed files.
  ; Never traverse a user-selected directory or change directory compression.
  Push $0
  SetOutPath "$INSTDIR"
  nsExec::Exec '"$SYSDIR\compact.exe" /C /EXE:LZX /I /Q "${APP_EXECUTABLE_FILENAME}" "dxcompiler.dll" "dxil.dll" "libGLESv2.dll" "libEGL.dll" "vk_swiftshader.dll" "vulkan-1.dll" "d3dcompiler_47.dll" "ffmpeg.dll" "icudtl.dat" "resources.pak" "chrome_100_percent.pak" "chrome_200_percent.pak" "snapshot_blob.bin" "v8_context_snapshot.bin" "resources\app.asar" "resources\sql-wasm.wasm" "locales\en-US.pak" "locales\zh-CN.pak"'
  Pop $0
  ; The regular files are already installed and usable on unsupported volumes.
  StrCmp $0 "0" +2
    DetailPrint "Windows file compression was unavailable or incomplete ($0)."
  Pop $0
!macroend

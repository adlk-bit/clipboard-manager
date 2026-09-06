using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// A narrow stdin/stdout bridge. No clipboard content, window titles, paths,
// network access, key logging, or arbitrary commands cross this protocol.
internal sealed class ClipboardBridge : NativeWindow
{
    private static readonly object OutputLock = new object();
    private static int parentPid;
    private static uint lastSequence;
    private static bool listener;
    private static System.Threading.Timer watchdog;

    [DllImport("user32.dll", SetLastError = true)] private static extern bool AddClipboardFormatListener(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern bool RemoveClipboardFormatListener(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern uint GetClipboardSequenceNumber();
    [DllImport("user32.dll")] private static extern IntPtr GetClipboardOwner();
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [StructLayout(LayoutKind.Sequential)] private struct KEYBDINPUT { public ushort key, scan; public uint flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] private struct MOUSEINPUT { public int x, y; public uint data, flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Explicit)] private struct INPUTUNION { [FieldOffset(0)] public KEYBDINPUT keyboard; [FieldOffset(0)] public MOUSEINPUT mouse; }
    [StructLayout(LayoutKind.Sequential)] private struct INPUT { public uint type; public INPUTUNION value; }

    private static void Write(object data)
    {
        lock (OutputLock) { Console.WriteLine(new JavaScriptSerializer().Serialize(data)); Console.Out.Flush(); }
    }
    private static uint Pid(IntPtr handle) { uint pid; GetWindowThreadProcessId(handle, out pid); return pid; }
    private static string ProcessName(uint pid)
    {
        if (pid == 0) return "";
        try { using (Process process = Process.GetProcessById((int)pid)) return process.ProcessName.ToLowerInvariant() + ".exe"; }
        catch { return ""; }
    }
    private static object State()
    {
        uint sequence = GetClipboardSequenceNumber();
        IntPtr owner = GetClipboardOwner();
        return new { sequence = sequence, sourceApp = ProcessName(Pid(owner)), ownerPid = Pid(owner) };
    }
    protected override void WndProc(ref Message message)
    {
        if (message.Msg == 0x031D)
        {
            uint sequence = GetClipboardSequenceNumber();
            if (sequence != lastSequence) { lastSequence = sequence; Write(new { type = "clipboard", state = State() }); }
        }
        base.WndProc(ref message);
    }
    private static bool ModifiersDown()
    {
        foreach (int key in new int[] { 0x10, 0x11, 0x12, 0x5B, 0x5C }) if ((GetAsyncKeyState(key) & 0x8000) != 0) return true;
        return false;
    }
    private static INPUT Key(ushort key, bool up)
    {
        return new INPUT { type = 1, value = new INPUTUNION { keyboard = new KEYBDINPUT { key = key, flags = up ? 2U : 0U } } };
    }
    private static object Command(Dictionary<string, object> request)
    {
        string action = Convert.ToString(request["action"]);
        if (action == "state") return State();
        if (action == "foreground")
        {
            IntPtr window = GetForegroundWindow(); uint pid = Pid(window);
            return new { handle = window.ToInt64().ToString(), pid = pid, sourceApp = ProcessName(pid) };
        }
        long rawHandle;
        if (!request.ContainsKey("handle") || !Int64.TryParse(Convert.ToString(request["handle"]), out rawHandle)) throw new Exception("invalid-window");
        IntPtr handle = new IntPtr(rawHandle);
        if (!IsWindow(handle)) throw new Exception("window-closed");
        if (action == "topmost" || action == "setTopmost")
        {
            if (Pid(handle) != parentPid) throw new Exception("foreign-window");
            if (action == "setTopmost")
            {
                bool enabled = Convert.ToBoolean(request["enabled"]);
                if (!SetWindowPos(handle, new IntPtr(enabled ? -1 : -2), 0, 0, 0, 0, 0x0013)) throw new Exception("topmost-failed");
            }
            return (GetWindowLong(handle, -20) & 0x00000008) != 0;
        }
        if (action == "paste")
        {
            uint pid = Convert.ToUInt32(request["pid"]);
            if (pid == parentPid || pid == 0 || Pid(handle) != pid) throw new Exception("invalid-target");
            // The user chooses the destination by focusing it, then pressing the
            // queue shortcut. Never steal focus or paste into a substituted HWND.
            for (int i = 0; i < 100 && ModifiersDown(); i++) Thread.Sleep(15);
            if (ModifiersDown()) throw new Exception("release-shortcut");
            if (!IsWindow(handle) || GetForegroundWindow() != handle || Pid(handle) != pid) throw new Exception("target-changed");
            if (!request.ContainsKey("sequence") || GetClipboardSequenceNumber() != Convert.ToUInt32(request["sequence"])) throw new Exception("clipboard-changed");
            INPUT[] inputs = { Key(0x11, false), Key(0x56, false), Key(0x56, true), Key(0x11, true) };
            uint sent = SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
            if (sent != inputs.Length)
            {
                // Release only keys potentially introduced by this injection.
                if (sent > 0) { INPUT[] release = { Key(0x56, true), Key(0x11, true) }; SendInput(2, release, Marshal.SizeOf(typeof(INPUT))); }
                throw new Exception(sent == 0 ? "input-blocked" : "input-uncertain");
            }
            return true;
        }
        throw new Exception("unknown-command");
    }
    [STAThread] private static void Main(string[] args)
    {
        if (args.Length != 1 || !Int32.TryParse(args[0], out parentPid)) return;
        Console.InputEncoding = new UTF8Encoding(false); Console.OutputEncoding = new UTF8Encoding(false);
        var window = new ClipboardBridge();
        window.CreateHandle(new CreateParams { Caption = "ClipboardManagerBridge", Parent = new IntPtr(-3) });
        lastSequence = GetClipboardSequenceNumber();
        listener = AddClipboardFormatListener(window.Handle);
        Write(new { type = "ready", listener = listener, state = State() });
        watchdog = new System.Threading.Timer(delegate {
            try { using (Process process = Process.GetProcessById(parentPid)) { if (process.HasExited) Environment.Exit(0); } }
            catch { Environment.Exit(0); }
        }, null, 5000, 5000);
        var inputThread = new Thread(delegate() {
            string line;
            while ((line = Console.ReadLine()) != null)
            {
                int id = 0;
                try
                {
                    if (line.Length > 4096) throw new Exception("request-too-large");
                    var request = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(line);
                    id = Convert.ToInt32(request["id"]);
                    Write(new { id = id, result = Command(request) });
                }
                catch (Exception error) { Write(new { id = id, error = error.Message }); }
            }
            Environment.Exit(0);
        });
        inputThread.IsBackground = true; inputThread.Start();
        Application.Run();
        RemoveClipboardFormatListener(window.Handle); watchdog.Dispose();
    }
}

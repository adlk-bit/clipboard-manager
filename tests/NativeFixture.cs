// Isolated, synthetic clipboard/paste target used only by the opt-in desktop
// integration suite. Never shipped in the application.
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Windows.Forms;
class NativeFixture : Form {
  List<string> keys = new List<string>();
  TextBox box = new TextBox { Multiline = true, Dock = DockStyle.Fill };
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
  [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr hwnd, int id, uint modifiers, uint key);
  [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hwnd, int id);
  protected override void WndProc(ref Message message) {
    if (message.Msg == 0x0312 && message.WParam.ToInt32() == 99) {
      UnregisterHotKey(Handle, 99); Show(); Activate(); SetForegroundWindow(Handle); box.Focus();
      Write(GetForegroundWindow() == Handle ? (object)new { ok = true } : new { error = "Fixture could not acquire foreground" });
    }
    base.WndProc(ref message);
  }
  [DllImport("user32.dll")] static extern uint SendInput(uint count, INPUT[] inputs, int size);
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION union; }
  [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public KEY key; [FieldOffset(0)] public MOUSE mouse; }
  [StructLayout(LayoutKind.Sequential)] struct KEY { public ushort key, scan; public uint flags, time; public UIntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSE { public int x, y; public uint data, flags, time; public UIntPtr extra; }
  static INPUT K(ushort key, bool up) { return new INPUT { type = 1, union = new UNION { key = new KEY { key = key, flags = up ? 2U : 0U } } }; }
  static void Write(object value) { Console.WriteLine(new JavaScriptSerializer().Serialize(value)); Console.Out.Flush(); }
  NativeFixture() {
    Text = "Clipboard Manager synthetic paste test"; Width = 460; Height = 220; Controls.Add(box);
    box.KeyDown += delegate(object sender, KeyEventArgs e) { keys.Add(e.KeyData.ToString()); };
    Shown += delegate { Write(new { ready = true }); };
    var thread = new Thread(delegate() {
      string line;
      while ((line = Console.ReadLine()) != null) {
        var request = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(line);
        Invoke((Action)delegate {
          try {
            string action = Convert.ToString(request["action"]);
            if (action == "focus") {
              Show(); Activate(); box.Focus(); SetForegroundWindow(Handle);
              if (GetForegroundWindow() != Handle) {
                // A registered test-only hotkey uses Windows' normal activation
                // mechanism. Do not bypass focus locks or attach input threads.
                if (!RegisterHotKey(Handle, 99, 0x4000, 0x87)) throw new Exception("Test activation shortcut unavailable");
                INPUT[] activate = { K(0x87,false), K(0x87,true) };
                if (SendInput(2, activate, Marshal.SizeOf(typeof(INPUT))) != 2) { UnregisterHotKey(Handle,99); throw new Exception("Test activation failed"); }
                return;
              }
            }
            if (action == "read") { Write(new { text = box.Text, focused = box.Focused, active = ActiveControl == box, foreground = GetForegroundWindow().ToInt64(), handle = Handle.ToInt64(), pid = System.Diagnostics.Process.GetCurrentProcess().Id, keys = keys.ToArray() }); return; }
            if (action == "copy") Clipboard.SetText(Convert.ToString(request["text"]));
            if (action == "image") {
              using (var bitmap = new Bitmap(1800, 1000)) {
                using (var graphics = Graphics.FromImage(bitmap)) {
                  graphics.Clear(Color.White);
                  using (var font = new Font("Arial", 64)) graphics.DrawString("Clipboard Productivity 2048", font, Brushes.Black, 50, 100);
                  using (var font = new Font("Microsoft YaHei", 56)) graphics.DrawString("本地文字识别测试", font, Brushes.Black, 50, 300);
                }
                bitmap.Save(Convert.ToString(request["path"]), ImageFormat.Png);
                if (request.ContainsKey("copy") && Convert.ToBoolean(request["copy"])) Clipboard.SetImage(bitmap);
              }
            }
            if (action == "shortcut") {
              if (GetForegroundWindow() != Handle) throw new Exception("Fixture must be foreground before injecting test shortcut");
              INPUT[] inputs = { K(0x11,false), K(0x10,false), K(0x12,false), K(0x56,false), K(0x56,true), K(0x12,true), K(0x10,true), K(0x11,true) };
              if (SendInput(8, inputs, Marshal.SizeOf(typeof(INPUT))) != 8) throw new Exception("Shortcut input failed");
            }
            if (action == "quick-shortcut") {
              if (GetForegroundWindow() != Handle) throw new Exception("Fixture must be foreground before injecting quick-paste shortcut");
              INPUT[] inputs = { K(0x11,false), K(0x10,false), K(0x7A,false), K(0x7A,true), K(0x10,true), K(0x11,true) };
              if (SendInput(6, inputs, Marshal.SizeOf(typeof(INPUT))) != 6) throw new Exception("Shortcut input failed");
            }
            if (action == "panel-key") {
              IntPtr panel = new IntPtr(Convert.ToInt64(request["handle"]));
              uint panelPid; GetWindowThreadProcessId(panel, out panelPid);
              if (GetForegroundWindow() != panel || panelPid != Convert.ToUInt32(request["pid"])) throw new Exception("Test panel must own foreground");
              ushort key = Convert.ToUInt16(request["key"]);
              bool ctrl = request.ContainsKey("ctrl") && Convert.ToBoolean(request["ctrl"]);
              INPUT[] inputs = ctrl ? new INPUT[] { K(0x11,false), K(key,false), K(key,true), K(0x11,true) } : new INPUT[] { K(key,false), K(key,true) };
              if (SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT))) != inputs.Length) throw new Exception("Panel key failed");
            }
            Write(new { ok = true });
          } catch (Exception error) { Write(new { error = error.Message }); }
        });
      }
      BeginInvoke((Action)delegate { Close(); });
    });
    thread.IsBackground = true; thread.Start();
  }
  [STAThread] static void Main() {
    Console.InputEncoding = new System.Text.UTF8Encoding(false); Console.OutputEncoding = new System.Text.UTF8Encoding(false);
    Application.Run(new NativeFixture());
  }
}

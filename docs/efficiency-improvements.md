# 剪贴板效率改进

日期：2026-09-05。版本：v1.2.0。本轮主要改进桌面效率；Android 配套端同步版本号，功能未改动。安装包与发布验证见 [v1.2.0 发布说明](releases/v1.2.0.md)。

## 已实施

| 日常问题 | 改进 | 使用方式 |
|---|---|---|
| 文字、网址和截图混在一起，找记录慢 | 全部 / 文字 / 链接 / 图片筛选；链接沿用现有完整 HTTP(S) 网址识别规则 | 历史、收藏页顶部筛选；筛选可与目录和搜索组合 |
| 只记得内容与标签里的几个词 | 多关键词同时匹配内容、目录或标签；`%`、`_`、反斜杠作为原字符查找 | 输入“工作 紧急”即可跨内容与元数据查找 |
| 快速输入或切页时旧结果回跳 | 搜索输入立即使旧请求失效；取消切页前的延迟搜索；旧页面回调不覆盖当前列表 | 自动生效；删除/筛选后移除不可见的选择项 |
| 搜索后还得切换鼠标才能复制 | 搜索框内支持上下选择、Enter 复制并收起；当前列表前九条快速复制 | `Ctrl+F` 搜索，`↑/↓` 选择，`Enter` 复制，`Ctrl+1`–`Ctrl+9` 快选；`Space` 编辑选中的文字 |
| 批量管理入口藏在列表最底部 | 将入口移至固定顶部工具栏 | 无需先滚动长列表 |
| 多次复制的内容需要手动粘贴拼接 | 多条文字合并预览，支持列表顺序/倒序、四种分隔符 | 多选至少两条文字 → 合并复制 → 预览；混有图片时禁止文字合并 |
| 从网页/PDF/表格复制后需要反复清理 | 去每行首尾空白、去空行、按行去重、合为一行、大小写转换、JSON 格式化/压缩 | 单条编辑或合并窗口中选择工具并应用，可撤销最近 20 步或重置 |
| JSON 格式化可能改变大整数、小数或重复键 | 先验证语法，再对原始 JSON 标记调整空白；不重新序列化解析后的数值 | 原始数字、键顺序、重复键和字符串转义均保留 |
| 超长合并内容可能被悄悄截断 | 保留完整编辑内容并显示超限提示，禁止复制超过 10,000 字的修改结果 | 可缩短后复制；未改动的已有长记录仍可走原记录复制通道 |
| 脱敏卡片的复制提示暴露原文 | 成功提示只显示复制状态 | 实际复制内容仍为原文 |
| 导航/选择刷新过多卡片 | 每张卡片只订阅自身是否选中/激活；稳定编辑与提示回调 | 不增加运行时依赖 |
| 每次复制都同步扫描图片文件大小 | 普通历史刷新不查询图片占用；设置页按需更新，设置读取并行进行 | 保留设置页占用显示 |

输入法组合输入、编辑框和确认弹窗会阻止后台列表快捷键。`Esc` 依次关闭编辑框、退出多选、清除搜索或收起窗口。合并分隔符/顺序改变会重建预览，界面有明确说明且可撤销；不会覆盖原历史记录。正常采集开启时，新复制的合并/修改文本仍按原有采集规则进入历史。

## 验证

- 32 项单元测试通过，包含实际 SQLite 搜索、乱序异步响应、导航/输入竞态、选择项清理、合并、文本处理和 JSON 精度保留。
- 主进程和渲染进程 TypeScript 检查通过，生产构建通过。
- 新增真实 Electron 测试通过：类型筛选、多关键词/字面量搜索、搜索框键盘选择、合并顺序、图片排除、撤销、错误 JSON、超长文本、弹窗快捷键隔离。
- 在临时用户目录运行，使用合成记录；系统剪贴板验证覆盖合并内容、原记录不变、脱敏复制提示、`Ctrl+3` 复制第三条及窗口收起。测试只在能保存现有剪贴板格式时执行成功写入，并在结束时恢复仍由测试占用的剪贴板，避免覆盖用户期间的新复制。
- 已检查中英文、浅色/深色及默认 400 × 600、最小 320 × 400 的实际 Electron 截图；公开示例见 [中文历史页](images/history-v1.2.0-zh.png) 与 [文字合并](images/merge-v1.2.0-zh.png)。
- 完整旧版运行检查仍遇到已有的 Windows 窗口置顶间歇性失败。新增效率功能可独立验证；不将完整运行检查宣称为通过，也不宣称完成 Android 真机验证。v1.2.0 构建与安装包验证另见发布说明。

```powershell
npm.cmd test
npx.cmd tsc --noEmit -p tsconfig.node.json
npx.cmd tsc --noEmit -p tsconfig.web.json
npm.cmd run build
$env:RUNTIME_EFFICIENCY_ONLY = '1'
# 可选：验证真实系统剪贴板写入；另一个运行中的剪贴板工具也可能采集测试文字。
$env:RUNTIME_COPY_TESTS = '1'
node scripts/runtime-smoke.mjs
```

`RUNTIME_EFFICIENCY_ONLY=1` 只运行新增效率检查；不设置时仍运行原有完整流程。截图可通过 `RUNTIME_EFFICIENCY_SCREENSHOT_DIR` 指向已存在的输出目录。

## 建议的下一批功能（尚未实现）

| 优先级 | 功能 | 实际收益 | 建议实现边界 |
|---|---|---|---|
| P1 | 常用短语与变量模板 | 回复、邮件、教学通知不再反复改姓名、日期、金额 | 基于收藏新增模板标题和变量输入；预览后复制，不后台监听全部键盘 |
| P1 | 顺序粘贴队列 | 连续填姓名、电话、地址或多列表格，减少来回切窗 | 显示队列进度，跳过/撤回一步；自动粘贴前验证 Windows 焦点切换与目标窗口 |
| P1 | 采集性能与窗口置顶专项修复 | 长期驻留时减少重复处理大图片，并消除窗口置顶的不稳定 | 先记录大图驻留时的 CPU/唤醒频率与置顶 OS 状态，再考虑 Windows 剪贴板变更通知；有轮询回退 |
| P2 | 本地 OCR 与截图文字搜索 | 图片、题目截图和表格内容可直接检索/复制 | 用户触发识别，缓存结果，可删除索引；先评估语言包大小和实际准确率 |
| P2 | 来源应用筛选、采集排除规则 | 快速找浏览器/编辑器内容，减少无用历史 | 来源元数据最小化；排除应用与暂停状态清晰可见 |

先完善短语模板和顺序粘贴队列，更直接覆盖重复输入；OCR 会引入语言包、识别耗时与安装体积，需要单独验证后再接入。

## English summary

Implemented in v1.2.0: type filters, multi-keyword literal search, request-race protection, keyboard copy, accessible batch selection, text merging, reversible text tools, lossless JSON whitespace formatting, content-safe copy notifications, and reduced card/statistics refreshes. No runtime dependency was added. Android's version is synchronized without phone feature changes.

Validation: 32 unit tests, both TypeScript projects, production build, focused Electron UI/OS clipboard checks, and screenshot inspection passed. The existing full runtime suite still intermittently fails Windows always-on-top; it is not reported as passing. Suggested next work: variable-based text templates, a sequential paste queue, Windows capture/window reliability, optional local OCR, and source-app filters.

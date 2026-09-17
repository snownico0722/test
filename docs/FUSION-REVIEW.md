> 历史材料。当前交互、基线与验证结果以 [INTERACTION-REVISION.md](INTERACTION-REVISION.md) 为准。

# PaperTodo 官网融合改版：审阅说明

## 范围与版本

仅改 `snownico0722/test` 实验仓库，继续 PR #1 的 `feat/astra-playground-20260916`，不修改或发布正式站，不合并 PR，不报名比赛。

| 资料 | 固定版本／依据 |
| --- | --- |
| Playground 起点 | `be5098ee371d83092d8bc21bdee172a35d768970`，开始及打包前核对 PR 仍未合并、没有后来改动 |
| 旧站 | 同一提交的 `website/classic.html`，blob `9a2e6c7ff49bd00e41f761d453544b203297ae0c`，保持原字节 |
| 桌面 UI 主要源码 | PaperTodo `f65e64f7b519e0d4ebd18dba3faefac44ad87685` |
| 完成前复查的正式主线 | `d3deb598bb20db5e946d4a5b426289e6b9cdcbee`；对比前述版本仅修改 Codex CLI Bridge，未修改本次使用的纸片、主题、Markdown 源码 |
| 字体／真实 CLI 扩展补充 | 当前 `doc/USER_GUIDE.md`、`doc/USER_GUIDE.en.md`、`plugin-samples/PaperTodo.Plugin.CodexCliBridge/README.md` |

实验仓库完整文件树没有 AGENTS.md。先读取正式仓库 AGENTS.md，再进行只读 UI 对照；没有把正式仓库的开发状态当作网页已实现的功能。

## 旧站交互清单与迁移

| 原交互／信息 | 本次处理 |
| --- | --- |
| 总览 → 胶囊 → Markdown，同一固定产品区 | 保留，桌面共用一个 scene；小高度及窄屏使用章节内 scene，共用数据 |
| 待办勾选 | 保留，增加行内编辑、新增、勾选统计；主纸和预览共用任务状态 |
| 单纸折叠、展开 | 保留，折叠终点取当下实际胶囊坐标；改变布局时取消失效动画 |
| 主胶囊收起、展开队列 | 保留，不改动纸片内容和单纸折叠状态 |
| 配色、深浅色 | 对齐暖纸／墨／林／霞的真实颜色值，覆盖纸片、文字、工具栏、胶囊、脚本和工具纸片 |
| Markdown 三档、自动轮播及手选 | 改为“关闭／基础／完全渲染”，支持手选优先、原文编辑和完全渲染中的任务勾选 |
| MD 顶栏按钮 | 不再把它伪装成渲染档位按钮；明确解释其本机外部打开含义 |
| 脚本笔记 → 闪电胶囊 → 结果 | 保留为固定安全浏览器模拟；可重播、返回、右键返回，不执行 PowerShell |
| FAQ 折叠 | 五个原主题保留；签名警告不再使用未经核实的证书状态／“每台仅一次”承诺 |
| 语言、锚点、分段阅读 | 默认英文，完整中文；改用原生滚动和温和分段，删除强制拦截滚轮的整屏翻页；内部长内容可滚动 |
| 六项特性 | 纸片优先、多屏队列、待办关联笔记、本地图片、全局快捷键、原生 WPF；桌面两列，无新增量化性能宣传 |
| 下载 | Windows x64、可写目录、免安装、自包含 exe 推荐；运行时精简版说明独立列出 |

新增的悬停预览支持待办勾选、恢复完整纸片和队列排序。触屏点击、键盘 Enter/Escape 有等效路径。标题单独编辑；左侧图标为置顶；点状握柄拖动，方向键可移动，输入框方向键不抢占。网页新增和整理是演示便利功能。

三个原有插件模板及其核心实现保持不变。计时器自定义时长、开始／暂停／重置，习惯勾选，清单新增，取消生成，独立实例，源码与导出均保留。工作台放在脚本之后，不再顶替核心产品主线。

## 软件 UI 参考对照

| 对象 | 已核对的源码／文档 | 网页表达与限制 |
| --- | --- | --- |
| 待办、笔记顶栏 | `src/PaperWindow.cs` 的 `BuildTopBar`（约 2092–2340 行） | 左侧置顶、可编辑标题，右侧关联、笔记 MD、新建待办／笔记、折叠；保持相对位置。窄屏隐藏部分右侧操作，并在底栏保留新增入口 |
| 置顶含义 | 同文件 `_paperIconButton.Click → ToggleTopmost()` | 只在网页画布中置顶，不声称修改 Windows 层级；拖动握柄独立 |
| Markdown 档位 | `src/AppController.Settings.NotePage.cs`；`Resources/Strings.resx`、`Strings.en.resx` | Off／Basic／Full Render；关闭／基础／完全渲染。网页按钮放在讲解区，说明实际软件在设置→笔记选择 |
| 配色 | `src/Theme.cs` 的四套 Light／Dark Palette | 使用源码 Paper、Border、Text、WeakText、Active、Code、Link、CheckBox 色值；网站品牌背景独立 |
| 预览行为 | README 的 Edge Capsules & Live Preview Cards；`src/AppController.EdgeCapsulePreview.cs` 等入口 | 待办可滚动勾选，点击背景或明确按钮恢复；笔记只读渲染。触屏以点击代替悬停，不复刻 Win32 命中／意图预测实现 |
| 主胶囊、多屏 | README 的 Master Capsule 说明、旧站交互 | 网页只演示一组队列、换边、队列收起及顺序；不声称网页拖动跨真实显示器 |
| 脚本 | README 的 `!p`／`!power` 说明 | 固定本地模拟，源码和结果均不执行用户脚本 |
| 插件 | `plugin-samples/README.md`；Codex CLI Bridge README | 模板不是实时 AI。真实 CLI 需要本机安装登录；本次没有 Windows/Codex 运行录像，不能作为真实调用证据 |
| 下载、数据、字体 | README、两份用户手册 | 推荐自包含 exe；保留数据文件和完整目录迁移；支持 ttf／otf 字体；未下载或执行 Windows 安装包 |

### 截图与源码推断必须分开

定位到了正式仓库的 `assets/Home.jpg`、`assets/Md.jpg`、`assets/Pill_Mode.gif`、`assets/Pill_Plus.gif`，但未将其作为“当前实机截图”逐像素核验。因此本次只称为**依据当前源码和文档设计的网页交互演示**，不称最新版实机复刻。

仍需要当前 Windows 4.0 运行截图或录像确认：顶栏自适应的实际观感、胶囊及预览卡的精确几何、主胶囊滑出效果、Markdown 编辑／阅读过渡、跨屏与混合 DPI、真实 CLI 运行。网页的字号、间距、拖动握柄、触屏按钮、预览恢复按钮和模式对照是明确的网页适配。

轻量网页 Markdown 仅演示标题、列表、任务、引用、代码、链接等常用结构；不是桌面 WPF 解析器，不包含本地图片 LMDB、表格或完整编辑语义。悬停延时及动画不是桌面性能测量。

## 状态和边界

`story-core.mjs` 管数据，`playground.mjs` 负责交互，`copy.mjs` 管双语。响应式视图不另存内容。自定义标题、待办文字、未提交输入、笔记文字、勾选、主题、队列和手动档位跨语言／章节保留。

进入 Markdown 只暂时展开主笔记，不覆盖原折叠状态；退出恢复。用户操作后自动展示让出控制，隐藏页面、离开章节、减少动画偏好均使相关定时展示停止。网页限额明确标为演示限额，刷新重置，重置按钮二次确认。

没有模型 API、密钥输入、后台服务、遥测、PowerShell 执行或桌面安装。模板导出是固定初始配置的独立 HTML，不是运行中状态快照。脚本结果、CLI 能力说明和网页实际模板操作分别呈现，不混为一谈。

## 验证结果

| 类别 | 结果 | 不能推出的结论 |
| --- | --- | --- |
| Node 单元／静态测试 | 45/45，通过原有 24 项及新增状态、渲染、元信息测试 | 不等于浏览器布局通过 |
| Chromium 144 真实 DOM 交互 | 25/25，显式 DOM_ONLY 模式；含鼠标／键盘、所有主题值、折叠终点几何、真实 Blob 导出与导出页操作 | 不等于 HTTP 模块加载、首页 CSP 或正式部署通过 |
| 布局 | 中英文 320、390、430、768、1024、1440、1920px，另测 720×450；核心操作与无横向溢出断言通过 | 不是所有真实手机、浏览器和系统字体均已测 |
| 页面 HTTP 导航 | 已实际尝试，`net::ERR_BLOCKED_BY_ADMINISTRATOR` | 明确未通过；不能用注入页面替代本项验收 |
| 可见性生命周期 | 隐藏状态的合成事件与减少动画偏好检查通过 | 不等于操作系统后台节流的实测 |
| 截图 | 20 张最终页面截图：桌面／手机 × 中／英文 × 首屏／胶囊／Markdown／脚本／插件 | 全部是网页 DOM_ONLY 截图，不是 Windows 软件截图 |
| 原生桌面程序 | 只读源码和文档核对 | 未在本环境运行 Windows 程序、原生插件或多屏交互 |

浏览器默认脚本使用真实 HTTP，包含根路径和 `/nested/test/` 子路径；仅显式设置 `PAPER_DEMO_IN_MEMORY=1` 才进入受限 DOM 测试。没有修改管理策略。导出的独立 HTML 使用自己的 CSP 运行；首页 CSP 在 DOM fixture 中移除，必须通过普通 HTTP 环境另验。

CI 是纯检查／生成截图／上传工件，没有部署。是否已获得真实 HTTP 验收，以对应提交的 CI 运行结果为准，不以“已加入工作流”代替通过。

## 截图与交付文件

截图路径：`evidence/screenshots/{desktop|mobile}-{en|zh}-{overview|capsules|markdown|scripts|plugins}.png`。`index.json` 记录模式与视口。手机图保留完整章节长图，避免裁掉底部操作区。分享图 `website/assets/share-preview.jpg` 裁自最终英文桌面页面，非生成概念图。

旧 sitemap 指向正式站，实验分支不再沿用。确认实际部署地址后才用 `scripts/configure-site.mjs` 写入 canonical、绝对分享图、robots 和 sitemap；不会自动部署。

## 远端状态

平台拦截了本次 GitHub 写入调用，未创建远端提交，未更新 PR，未运行远端 CI。交付为源码替换包；不能将“本地完成”和“已加入包内的 CI”描述成已经推送或检查通过。`apply-fusion.ps1` 只在原分支基线、干净工作区中应用文件并备份，不提交、不推送。

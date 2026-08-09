# `b0923d4` 历史版本对标、功能恢复与回归验收报告

验收日期：2026-08-05  
唯一历史基准：`b0923d471abbf85f0bf88fbb635cefbbbb041e37`（2026-07-29，`Update style.css`）  
本轮当前版本起点：`4668bee93828b301b40b62bcab68ef0f818ffacd`  
范围：代码审计、答题内容安全恢复、统计页滚动条修复、背景与长列表滚动优化、排版统一、自动化测试、生产构建和公开页面浏览器验收。

## 1. 旧版本功能概览

历史版本是一套多入口静态应用，核心能力包括邀请门禁、普通/书面记录、人物、名言、全站搜索、答题、时间线统计、补充资料、蹭饭图、背景主题与管理员工具。正文使用自定义标记语言，历史解析器可识别 `del`、`under`、`red`、`hide`、`sup`、`sub`、`center`、`right`、人物/名言/记录/资料引用、注释、插图、分数、箭头和表格。

长期功能矩阵与先前审计证据见：

- `docs/baseline-b0923d4-functional-spec.md`
- `docs/baseline-b0923d4-maintenance-matrix.md`
- `docs/current-version-gap-audit.md`
- `docs/legacy-baseline-audit.md`
- `docs/baseline-b0923d4-remediation-report-2026-08-04.md`

## 2. 旧版本关键实现与行为基准

旧版正文通过 `formatTrustedContent` 将标记解析为 HTML；答题数据生成阶段则对正文执行 `stripRecordMarkup`，因此旧版答题只保留纯文本。它具备题型与抽样行为基准，但没有真正保留 `[[center:...]]` 等版式。当前要求明确提出答题正文恢复居中和安全标记，因此本轮以旧版题型/抽样为行为基准，在安全边界上采用更严格的 React AST 渲染，而不是复制旧版 HTML 注入路径。

旧版统计页的阅读顺序为总览、全档案趋势、年度、月份、每日图表、七列日历、图例与洞察；旧版没有当前重构中由强制溢出容器造成的额外滚动区域。背景和记录页则以单页面、较少固定合成层为主要基准。

## 3. 当前版本与旧版的主要差异

本轮复核发现的实际差异如下：

1. `quiz-engine.ts` 在生成题目时调用 `stripMarkup(record.content)`，使 `center` 等结构在进入 React 渲染前已经丢失。
2. 填空题把真实答案放入透明 `<span>`；虽然视觉上隐藏，答案仍可出现在 DOM、复制结果和辅助技术可访问树附近。
3. 统计页记录人图例同时设置 `max-h-44` 与 `overflow-y-auto`，在最多六项的有限数据上人为制造内部纵向滚动条。
4. 背景由固定主图层、独立固定暗角层和带 `backdrop-blur-xl` 的粘性顶栏叠加；记录长列表快速滚动时会扩大每帧合成与模糊重算面积。
5. 字号、标题、正文、控件与元信息在多个页面存在局部数值，缺少统一语义尺度。
6. 记录搜索栏此前的异常空隙已经在当前起点版本修复；本轮核对没有发现负 margin、固定最小高度或占位骨架回归。

## 4. 答题页允许的正文语法

答题页新增专用安全解析入口 `parseQuizMarkup`，允许且保留以下可见语义：

- 行内样式：`del`、`under`、`red`、`sup`、`sub`。
- 布局：`center`、`right`，其中 `[[center:...]]` 会在题目正文中保持居中。
- 结构：分数、箭头、表格；表格使用 `width: 100%`、`min-width: 0`、固定表格布局和单元格断行，避免制造内部横向滚动条。
- 普通文本与嵌套安全节点。

这些节点从共享标记 AST 转换为 React 元素，不执行原始 HTML，不把用户内容写入 `dangerouslySetInnerHTML`。

## 5. 限制、降级与禁止的语法

答题场景按“只保留完成题目所必需的可见语义”处理：

- 人物、名言、记录、资料引用：限制为纯可见文字；不创建链接、ID、`data-*`、悬浮卡或可复制的内部标识。
- 注释：只保留可见标签；注释正文删除。
- 插图标记：只保留可见标签；路径、签名 URL、图片节点和悬浮预览删除。
- `hide`：不渲染子内容，只显示固定文本“〔隐藏内容已省略〕”。
- 未知或非法节点：不执行、不注入；按解析器的安全文本降级规则处理。

## 6. 防答案泄漏方案

填空题未揭晓前，真实答案不再出现在渲染 DOM 中。空位只包含屏幕阅读器文本“此处挖空”和根据字符数计算的宽度变量；答案不会进入文本节点、`aria-label`、`title`、`data-*` 或透明元素。

人物/名言题把被抽中的引用 ID 作为内部题目状态传入安全解析器。解析器会将该 ID 的所有别名统一替换为当前答案占位，再由渲染器一次性挖空，避免同一人物或名言的另一个别名在正文中旁路泄漏。揭晓后才渲染答案与判断题纠正内容。

题目对象仍必须在 JavaScript 内存中保存答案以完成判题；本轮保证的是未揭晓答案不进入页面 DOM、可访问属性、工具提示、链接或普通复制内容。选择题选项中包含正确选项属于题型本身，不视为隐藏答案泄漏。

## 7. 统计页布局复核

此前已恢复旧版层级：总览、全档案趋势、年度占比与年份选择、月度占比与月份选择、月度摘要、每日柱图、桌面七列/移动四列日历、记录人图例。图表容器保持显式高度、`width: 100%` 与 `min-width: 0`，不再按数据点动态计算最小宽度；年份/月度控件自动换行。

本轮新增修复集中在图例：最多六项记录人直接展开在卡片内，不再给有限内容套内部滚动区。

## 8. 统计页滚动条根因与修复

“上/下三角形与中间轨道”不是业务组件，而是浏览器/系统为 `overflow-y-auto` 容器绘制的滚动条。根因是图例的 `max-h-44 overflow-y-auto`，不是 Recharts 图标或事件处理器。

修复是删除这两个强制约束，让卡片按内容自然增高。项目使用的图例最多六项，不存在需要固定高度虚拟化的理由。与此同时保留真正需要固定高度的图表容器；这与 shadcn 对 ScrollArea 只应用于明确固定/最大高度区域的用法一致。

## 9. 背景显示与稳定性

背景选择、持久化、调色板、占位色和 560ms 交叉淡入逻辑均保留。暗角径向渐变被合并到主背景层，稳定状态由两个固定视觉层降为一个背景层；只有切换主题的淡入期间短暂同时存在当前层与上一层。

`.background-layer` 增加 `contain: strict`、`translateZ(0)` 和 `backface-visibility: hidden`，使背景形成明确的合成边界。顶栏改为 96% 不透明表面并移除 `backdrop-filter`，保证文字可读性，同时避免滚动过程中持续重算全宽背景模糊。公开页面实测稳定状态只有一个背景层，顶栏计算样式为 `backdrop-filter: none`。

## 10. 记录页快速上下滚动根因与修复

代码审计未发现记录页滚动监听器、按滚动位置更新 React 状态、动态列表 `key` 或筛选时整树强制重挂载。记录卡键值仍为稳定的 `record.fileName || record.id`，图片保留比例占位并按意图加载。

主要压力来自页面外层：全屏固定背景、独立暗角和粘性模糊顶栏会在长列表快速滚动时叠加合成/采样成本。上述背景合层与取消顶栏背景模糊即为根因修复，不是降低动画帧数或隐藏内容的表面规避。由于没有可用的普通用户会话，本轮无法在真实长记录数据上录制滚动性能轨迹；已完成代码级根因排除、公开页实际合成层验证和生产构建验证。

## 11. 字体、字号、行高与间距体系

Tailwind 主题新增统一语义尺度：

- `text-page-title`：响应式页面标题与紧凑行高。
- `text-section-title`：响应式章节标题。
- `text-reading`：约 16–17.2px 的正文与 1.9 行高。
- `text-control`：14px、1.5 行高的控件文本。
- `text-meta`：13px、1.5 行高的元信息。

统一尺度已用于共享页标题、记录正文、答题题干、资料页、人物页与搜索分组标题。保留 Google Sans Flex/Geist 字体栈和既有卡片层次，没有编辑只读的 shadcn 组件目录。

## 12. 记录搜索栏空隙问题

复核 `PageHeading`、`RecordFilters` 和记录页容器后，当前实现只有正常的 `mb-5` 页面节奏；没有旧式负 margin、额外占位节点、固定 `min-height` 或加载骨架把搜索区推开。因此本轮没有为这一项添加无依据的补丁，只用静态回归契约继续防止间距结构倒退。

## 13. 全页面视觉审计结论

公开门禁页在 1280×720 和 390×844 下均无横向溢出，输入框和主按钮均为 44px 高，标题、字体栈、表面透明度和背景均正常。1024×768 下 `/records`、`/timeline`、`/quiz` 正确重定向至 `/auth`，未知路由保持 404；浏览器控制台 warning/error 为 0。

受保护页面的组件结构、响应式类、滚动容器和静态契约已逐页审查，但没有用伪造 session 或读取邀请码绕过门禁。因此真实数据下的记录、统计、答题和资料页视觉验收仍需有效普通用户会话。

## 14. 性能优化结论

本轮性能变化主要是确定性的绘制成本削减：稳定背景少一个固定全屏层，顶栏不再做实时背景模糊；答题安全标记只解析题目需要的内容，不触发引用卡、私有插图签名和图片加载；统计图例不创建内部滚动上下文。

现有路由级懒加载保留。生产构建转换 2,825 个模块，用时约 1.06 秒；主入口 290.78 kB（gzip 93.22 kB）、标记模块 16.84 kB（gzip 6.19 kB）、答题页 23.76 kB（gzip 8.96 kB）、懒加载统计页 376.06 kB（gzip 111.04 kB）。`dist` 总计 6,082,110 字节，只比本轮前 6,081,035 字节增加约 1,075 字节，仍比资源清理前的 14,797,993 字节小约 58.9%。

## 15. 请求、缓存与重复计算审计

此前完成的请求收口继续有效：普通记录首屏只加载记录；书面页、留言与补充资料只在书面视图按需并发；取消全局跨页面元数据预取；记录页只在空闲期预热最新记录内最多 16 个插图尺寸，并发上限为 3；其余插图在 pointer/focus/touch 意图或页面实际渲染时加载。

正文搜索文本和统计解析继续使用对象级 `WeakMap` 缓存，日期/年份/月度派生数据用 `useMemo` 或一次性索引复用。没有新增随滚动触发的请求、状态 effect 或重复解析链路。缓存层继续保留 memory/session/IndexedDB、并发合并、授权纪元隔离与部分可用策略。

## 16. 本轮修改文件

业务与样式：

- `frontend/src/lib/markup.ts`
- `frontend/src/features/quiz/quiz-engine.ts`
- `frontend/src/components/archive/markup-content.tsx`
- `frontend/src/components/archive/page-heading.tsx`
- `frontend/src/components/layout/app-shell.tsx`
- `frontend/src/components/layout/background-root.tsx`
- `frontend/src/pages/quiz-page.tsx`
- `frontend/src/pages/timeline-page.tsx`
- `frontend/src/pages/materials-page.tsx`
- `frontend/src/pages/person-page.tsx`
- `frontend/src/pages/search-page.tsx`
- `frontend/src/styles/tailwind.css`

回归契约：

- `scripts/test-record-markup.mjs`
- `scripts/test-quiz-core.mjs`
- `scripts/test-static-site.mjs`

文档：

- `docs/b0923d4-quiz-scroll-regression-report-2026-08-05.md`

`frontend/src/components/ui` 保持只读，差异为空。

## 17. 实际执行的验证命令

```bash
npm run typecheck
npm run lint
node scripts/test-security-boundaries.mjs
node scripts/test-secure-images.mjs
node scripts/test-image-loader.mjs
node scripts/test-auth-gate-loader.mjs
node scripts/test-cache-loader.mjs
node scripts/test-illustration-preload.mjs
node scripts/test-record-markup.mjs
node scripts/test-record-view.mjs
node scripts/test-quiz-core.mjs
node scripts/test-search.mjs
node scripts/test-static-site.mjs
npm run build
git diff --check
git diff --name-only -- frontend/src/components/ui
```

Biome 的 `--write` 仅格式化本轮改动范围，随后只读检查再次通过。一次经 npm 包装器运行的尝试因系统 npm 缓存盘 `ENOSPC` 失败；未删除用户缓存，改用项目已安装的同一 TypeScript、Biome、Node 与 Vite 可执行文件完成全部验证。

## 18. 自动化与人工验证结果

| 项目 | 结果 |
| --- | --- |
| TypeScript `tsc -b` | 通过 |
| Biome | 通过，52 个前端文件 |
| 自动化测试 | 11 组全部通过；静态应用契约覆盖 60 个 UI 组件 |
| 生产构建 | 通过，Vite 8.2.0，2,825 模块 |
| `git diff --check` | 通过，仅有 Git 的 LF/CRLF 工作区提示 |
| shadcn 只读目录 | 无差异 |
| 1280×720 门禁页 | 无横向/纵向意外溢出，控件 44px，单背景层 |
| 390×844 门禁页 | 无横向/纵向意外溢出，控件 44px，单背景层 |
| 1024×768 路由门禁/404 | 受保护路由重定向正确，404 正确 |
| 浏览器控制台 | 0 warning，0 error |

新增测试明确覆盖：`center`/安全样式保留；隐藏内容、注释正文、图片路径、内部引用 ID 不出现在安全 AST；同一引用的多个别名全部挖空；题目保留原始标记；旧透明答案 DOM 模式消失；未揭晓仅含固定占位；背景稳定层、无顶栏模糊和统计图例无内部滚动条。

## 19. 尚未完成的真实环境验收

以下事项没有被误报为已完成：

1. 使用有效普通用户邀请完成 token → RPC → RLS → 私有 Storage 签名的端到端验收。
2. 在真实长记录数据上连续快速上下滚动并录制浏览器 Performance trace。
3. 在真实统计数据上切换年份、月份、指标并检查所有图表、日历、来源跳转。
4. 实际完成普通/管理员答题全流程，检查题目揭晓、复制、辅助技术和可见引用行为。

本轮没有读取邀请码文件、检查浏览器凭据、伪造 session 或加入开发绕过。上述四项需要发布前由持有有效普通账号的验收者完成。

## 20. 剩余风险与后续建议

1. 管理员显式图片题仍需在 `<img src>` 中使用签名 URL。如果私有存储文件名本身包含答案，管理员可从网络面板或属性中看到线索；建议存储对象统一使用不含语义的 UUID 文件名，并把题意放在受控元数据中。
2. 题目答案必然存在于前端 JavaScript 内存以进行本地判题。若产品要求对具备 DevTools 能力的对手也隐藏答案，需要把判题迁移到服务端并只返回结果；这超出本轮 DOM/属性/复制/辅助技术防泄漏范围。
3. 统计页 Recharts 懒加载块约 376 kB；它不会进入其他页面首屏，但若真实低端设备仍感到切页慢，可进一步把统计计算移入 Web Worker，或对图表组件做更细粒度拆包，前提是先取得真实 trace。
4. 发布前应补做第 19 节四项 A 类验收，并保存桌面、平板、手机截图以及一次长列表性能轨迹，作为最终生产签字证据。

综合结论：本轮已经在代码层恢复答题安全标记与居中能力，消除未揭晓答案的 DOM 泄漏，移除统计图例的错误内部滚动条，降低背景与长列表滚动的全屏合成成本，并统一主要排版尺度。类型、格式、11 组测试、生产构建、公开页面浏览器检查和只读目录约束均已通过；剩余边界仅为需要真实普通用户授权的数据页人工验收。

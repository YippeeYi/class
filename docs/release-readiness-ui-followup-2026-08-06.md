# 旧版对标与发布前界面复核（2026-08-06 补充审查）

基准提交：`b0923d471abbf85f0bf88fbb635cefbbbb041e37`  
本轮起点：`ed50581`  
当前架构：React 19、React Router 8、Tailwind CSS 4、shadcn/ui（Base UI）、Vite 8、Supabase JS 2。

本报告是对既有 22 域维护矩阵的当前工作树复核，完整逐字段对照继续见：

- `docs/baseline-b0923d4-functional-spec.md`
- `docs/baseline-b0923d4-maintenance-matrix.md`
- `docs/legacy-baseline-audit.md`
- `docs/current-version-gap-audit.md`
- `docs/release-readiness-audit-2026-08-06.md`

## A. 旧版本功能审查

- 旧版共有门禁、导览、普通/书面记录、人物、名言、搜索、答题、时间线、资料、蹭饭图、背景、致谢、404、管理 CLI 等功能；当前 14 个路由均有对应实现。
- 记录基线包括普通/书面双视图、年/月/日联动、重要/例行/全文组合筛选、隐藏记录、页箴言、补充记录、附件、精确来源跳转和原上下文恢复。
- 名言基线包括 ID/正文排序、升降序、整行点击、唯一来源校验和精确记录跳转。旧版按正文排序前使用 `stripRecordMarkup`，不能直接比较原始标记串。
- 图片基线包括签名 URL 内存缓存、固有尺寸占位、有界重签、相邻页预载、原比例 `contain` 和大图查看器。
- 原生多文档页面卸载会天然重置局部状态；当前 SPA 通过 effect cleanup、URL 状态、稳定 key、请求合并和显式滚动恢复实现等价结果。
- 旧版绝对定位浮层已迁移为 shadcn/Base UI Portal；焦点、碰撞边界、触摸和父级 overflow 由当前组件层负责。

## B. 功能对照结果

- F01–F22 页面和功能域仍全部有当前代码对应；本轮未发现页面、入口或主要业务模块缺失。
- 数据、门禁、路由、正文 AST、缓存、图片签名、答题抽样、时间线统计和部署安全契约未被本轮视觉修改改变，11 组自动化回归全部通过。
- 本轮确认 5 项当前差异：筛选顶部叠加空白、箴言独立卡片、书面图片双层灰底、名言卡默认留白/网格拉伸、名言正文排序未剥离标记。
- 5 项均已修复并加入静态/业务契约；没有通过删除功能、刷新页面、重复请求或修改 shadcn 源码规避问题。
- 仍无法完成的内容只有有效普通/admin 邀请码下的真实数据 A 类验收；这不是通过本地伪造会话可以替代的检查。

## C. 记录页面修改

### C1. 筛选框顶部空白

- 根因：业务层 `Card` 保留 shadcn 默认纵向 padding，同时 `CardContent` 又添加 `pt-4`，搜索框上方形成两层内边距。
- 修复：`Card` 使用 `gap-0 py-0`，`CardContent` 统一为 `p-4`；搜索框成为内容区第一个节点，无空 Header、Spacer、固定高度或隐藏占位。
- 浏览器几何：1280px 与 390px 视口下，Card 顶边到搜索框顶边均为 16px；窄屏 `scrollWidth === clientWidth`。
- 筛选算法、URL 参数、联动日期、重要/例行 Toggle 和清除行为未改变。

### C2. 箴言记录

- 根因：书面页单独渲染 `Card className="bg-muted/45"`，绕过公共 `RecordCard`，导致外框、内边距、Header 和信息层级分裂。
- 修复：页箴言先按现有 `supplementalRecords` 数据规则转换成 `RecordItem`，再直接复用 `RecordCard`。
- 识别特征：公共卡片根据 `recordType` 渲染小型 `Badge`；箴言显示“箴言”，补充记录显示“补充”，不再使用大面积色块。
- 日期、作者、正文标记、内部记录引用、筛选命中与书面页顺序保持原规则。

### C3. 书面图片

- 根因：`ImageViewer` 触发按钮使用 `bg-muted/40 p-2`，内部固有尺寸容器再使用 `bg-muted/55`，形成双层灰色框和额外留白。
- 修复：触发器改为透明背景、0 padding、轻边框；固有尺寸容器改为透明背景。图片仍使用数据库/探测尺寸、`aspect-ratio`、显式 `width/height` 和 `object-contain`。
- 浏览器计算样式：图片按钮 `background-color: rgba(0, 0, 0, 0)`、`padding: 0px`。
- 签名、缓存、一次自动重签、手动重试、相邻页预载、加载几何和大图查看器代码未改变。

涉及文件：

- `frontend/src/components/archive/record-filters.tsx`
- `frontend/src/components/archive/record-card.tsx`
- `frontend/src/pages/records-page.tsx`
- `scripts/test-record-view.mjs`

## D. 名言页面修改

- 卡片过大根因：Card 默认上下 padding 与 `CardContent pt-4` 叠加；双列 Grid 默认 stretch 使短卡跟随同一行长卡高度。
- 顶部空白根因：Card 自身顶部 spacing 和内容顶部 padding 重复，图标行又使用较大 `mb-4`。
- 修复：Grid 使用 `items-start`；Card 使用 `h-fit gap-0 py-0`；内容区使用一次性的 `p-4 sm:p-5`；图标缩为 32px 方形轻强调；正文使用 `text-reading` 和弱左侧引用线；元信息使用可读的 `text-sm`。
- 跳转：恢复旧版整行/整卡点击语义，外层使用原生 `Link`，保留 Enter 激活、`focus-visible` ring、轻量 hover/active；唯一来源错误仍由页面 Alert 显示。
- 排序：按内容排序改为 `stripMarkup(a.quote)` 后比较，与旧版 `stripRecordMarkup` 行为一致；ID 排序和升降序保持不变。
- 浏览器几何：390px 下短名言卡约 156px，长名言卡约 249px，各自由内容决定；桌面双列短卡和长卡分别约 165px/231px，不互相拉伸。

涉及文件：

- `frontend/src/pages/quotes-page.tsx`
- `scripts/test-static-site.mjs`

## E. shadcn/ui 使用情况

- 继续组合 `Card`、`CardContent`、`Badge`、`Button`、`Input`、`Select`、`Toggle`、`Alert` 等现有组件。
- 移除的是业务层独立箴言 Card 分支和图片双层业务样式，没有复制或重写基础控件。
- `frontend/src/components/ui` 的 Git diff 为空；所有定制都位于业务组件 `className` 和类型分支。
- 公共业务封装集中在 `RecordCard`、`RecordFilters`、`ImageViewer` 与现有记录转换函数。

## F. 性能优化结果

- 箴言不再维护第二套渲染结构，公共 Card 行为和 memo 边界统一。
- 名言卡不再强制同一 Grid 行等高，减少无效绘制面积；过渡仅使用背景/阴影，不使用位置或尺寸动画。
- 图片保留固有尺寸，去掉外层 padding 与背景，不改变签名 URL 缓存或预载请求数量，不引入重复下载。
- 记录筛选继续使用 `WeakMap` 搜索文本缓存和 `useMemo` 日期选项；筛选不重挂整棵列表。
- 路由级 lazy import、请求 in-flight 合并、memory/session/IndexedDB 缓存和图片有界重签继续由原有自动化契约覆盖。
- 最终构建：2875 modules，1.05s；记录页 chunk 14.75 kB（gzip 6.00 kB），名言页 4.10 kB（gzip 2.00 kB）。

## G. 测试结果

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过，52 个文件，0 修复 |
| `npm test` | 11/11 组通过 |
| `npm run build` | 通过；沙箱内原生模块受限，沙箱外正式构建成功 |
| `npm audit` | 0 vulnerabilities |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `git diff --check` | 通过 |
| shadcn 只读目录 | 无差异 |
| 1280×720 公开浏览器 | `/auth`、受保护路由重定向、404、44px 控件、单背景层通过 |
| 390×844 公开浏览器 | 无横向溢出，认证 Card 358px，输入/按钮 44px，console 0 |
| 组件几何浏览器 | 筛选顶距、普通/箴言 Card、短/长名言、透明图片框、窄屏重排通过 |
| 图片比例契约 | 显式固有尺寸、`aspect-ratio`、`object-contain`、大图入口和有界重试保持 |

浏览器组件检查使用临时本地 harness，完成后已删除，未进入最终源码或构建产物。

## H. 发布状态

- 代码、静态检查、自动化测试、依赖审计和正式构建均通过；可以部署到预发布环境。
- 仍不能宣称可以直接切正式生产：本轮没有有效普通邀请码和 admin 邀请码，无法合法验证真实 RLS 数据页、私有图片续签、隐藏记录/题库和生产规模长列表快速滚动。
- 阻断位置不是单一代码缺陷，覆盖 `frontend/src/pages/*`、`frontend/src/features/auth/*`、`frontend/src/services/data.ts` 及 Supabase RLS/Storage 会话链路。
- 放行方式：在预发布环境使用受控普通/admin 邀请码完成维护矩阵 F01–F20 的 A 类验收，验证结束后撤销会话；不得通过读取本地邀请码、伪造 token 或放宽 RLS 代替。

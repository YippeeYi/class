# 《需要修改的问题列表（按优先级排序）》

## P0：安全、数据正确性与不可达核心内容

1. 修复签名 URL 永久缓存：引入普通 600 秒/敏感 180 秒寿命、提前刷新、force refresh、清理钩子。
2. 恢复页面消息和页面补充的数据 loader、类型与书面视图合并逻辑，确保只有消息的页面也可见。
3. 修复搜索结果 `.slice(0, 100)` 数据丢失，并恢复 URL query、评分、摘要高亮和全部结果。
4. 恢复全站缓存清理和 bfcache 复验，确保撤销权限后不存在可恢复的私有 UI/URL。
5. 修复正文未知/非法语法被吞文本的分支，保持安全原文降级。

## P1：基线核心体验恢复

6. 抽取可复用 RecordFilters，恢复 day、excludeDaily、联动选项和清理规则；人物页复用。
7. 恢复书面页页码选择、相邻预载、图文双栏、补充/箴言渲染、hidden written。
8. 恢复精确记录跳转高亮和“留在这里/返回原位置”shadcn Dialog/AlertDialog 体验。
9. 恢复人物三分组独立排序、固定学科顺序、老师主要置顶、签名头像和详情筛选。
10. 恢复 Quiz 等权抽样、筛选约束、补充来源、判断题校正和管理员隐藏题完整反馈。
11. 恢复时间线年度/月度/每日汇总、人物/作者/名言热度及可下钻图表。

## P2：图片、性能与交互细节

12. 建立共享 SecureImage/ImageViewer 领域组件：加载、失败重试、原图刷新、缩放、拖动、边界约束。
13. 为插图恢复 hover/focus/touch preview；按需预热尺寸和显示图，避免首次打开跳动。
14. 地图接入共享查看器和签名定时刷新。
15. 恢复授权纪元 session/IndexedDB 缓存、并发去重、stale 网络回退；hidden 不落盘。
16. 背景恢复安全署名链接、IntersectionObserver 预览和失败重试；动态 palette 作为后续可独立验证项。

## P3：shadcn 和视觉统一

17. 用官方 AlertDialog 替换 `window.confirm`；保持 Sidebar 官方实现不变。
18. 首页次级入口改为 shadcn Card/Item 组合，统一边界、圆角、hover 和图标尺寸。
19. 统一页面 loading/empty/error 密度，检查暗色和图片背景对比度。
20. 删除不再需要的兼容/legacy 分支，但不删除仍代表有效当前数据结构的 `raw` fallback。

## 验收门槛

- 类型检查、ESLint、单元/契约测试、生产构建全部通过。
- 对基准规格逐项复查，P0/P1 不得以“React 实现不同”为理由跳过用户可见能力。
- `frontend/src/components/ui` 无改动；新增特殊行为只能通过 props、className、wrapper 和 theme token。
- 普通用户无法请求 hidden 记录、hidden 页、管理员题库或其图片；签名 URL 不进入持久 storage、URL query、DOM 文本或日志。
- 搜索 125 条相同关键词结果全部可见；书面页消息/补充参与筛选；记录锚点可定位；图片签名过期可恢复。

## 执行状态

- P0：5/5 完成。
- P1：6/6 完成；判断题采用类型化题目模型生成并提供答案校正说明，不移植旧版 HTML 字符串替换代码。
- P2：共享图片查看、资源刷新、相邻书面页预载、授权纪元缓存、背景预览重试和动态取色缓存均已完成。
- P3：shadcn AlertDialog、Item、Sidebar、Select、Tabs、Toggle、Chart、Empty、Skeleton、Spinner 均按公开组合 API 使用；`frontend/src/components/ui` 零改动；无 legacy 兼容运行分支。
- 验证：TypeScript、Biome、11 组回归测试和 Vite 生产构建通过。

## 二次验收补充项

21. 修复记录、时间线、搜索、资料四处 URL 与 React state 的双向一致性，保证同页深链及浏览器历史可恢复。
22. 消除邀请码成功后的返回地址二次消费竞态，并改用 shadcn `FieldError` 的字段级错误语义。
23. 恢复致谢空状态、动态文档标题和背景摄影来源链接。
24. 补充 pathname 滚动复位、跳过导航入口、移动端 Sidebar 跳转后关闭和 Suspense Spinner。

状态：21–24 均已完成；它们属于首轮自动化契约未覆盖、但会直接影响真实浏览器体验的小功能。

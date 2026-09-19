# AGENTS.md

## Project Overview

本项目是一个长期维护的班级纪事网站。项目已经存在较完整的功能、页面结构、视觉体系、组件体系和交互规范。

任何修改都应以 **保持现有系统稳定、减少无关改动、复用已有实现、避免回归** 为最高优先级。

不要把单次任务理解为重新设计整个项目。除非任务明确要求，否则只修改完成当前需求所必需的内容。

---

# 1. Core Principles

## 1.1 最小修改原则

始终优先选择能够完成需求的最小范围修改。

必须：

- 只修改与当前任务直接相关的代码。
- 优先修改现有组件，而不是创建新的平行实现。
- 优先复用已有工具函数、hooks、组件、样式和设计模式。
- 优先修复问题根因，而不是通过额外覆盖临时隐藏问题。
- 保持现有代码结构和架构，除非现有结构确实无法满足当前需求。

禁止：

- 未经明确要求重构无关代码。
- 未经明确要求重新设计其他页面。
- 未经明确要求修改已有文案。
- 未经明确要求修改公共 API。
- 未经明确要求修改数据库结构。
- 未经明确要求修改认证、权限或数据访问逻辑。
- 未经明确要求重命名大量变量、函数、文件或组件。
- 未经明确要求格式化整个文件或整个项目。
- 为了“代码更漂亮”而扩大修改范围。
- 顺手修复与当前任务无关的问题。

如果发现其他问题，可以在最终报告中说明，但不要自行修改。

---

# 2. Read-Only Files and Directories

## 2.1 shadcn 组件目录

`frontend\src\components\ui` 目录为 shadcn 组件库文件，只读，禁止编辑。

等价路径：

`frontend/src/components/ui`

该目录及其所有子文件均视为第三方/基础组件层。

严格禁止：

- 编辑其中任何文件。
- 修改其中组件的默认实现。
- 修改其中样式。
- 修改其中 className。
- 修改其中类型定义。
- 修改其中动画。
- 为满足业务需求直接 patch 该目录中的组件。
- 对该目录执行批量格式化或重构。

如果业务需求需要改变 shadcn 组件表现，应：

1. 在业务组件中通过 `className`、props 或组合方式实现；
2. 在 `frontend/src/components/ui` 之外创建业务层 wrapper；
3. 使用项目现有样式系统进行覆盖；
4. 优先寻找项目中已有的 wrapper 或类似使用方式。

不得以“实现更简单”为理由修改 `frontend/src/components/ui`。

如果任务似乎必须修改该目录才能完成，应停止这种实现方式，寻找替代方案。

---

# 3. Existing Code Is the Source of Truth

开始实现之前，必须先阅读相关代码。

不得根据文件名、组件名或经验猜测当前实现。

应优先调查：

- 当前页面实现。
- 当前组件实现。
- 与需求相关的数据流。
- 已有类似功能。
- 已有类似交互。
- 已有相似动画。
- 已有相似布局。
- 已有工具函数。
- 已有 hooks。
- 已有 responsive 实现。
- 已有 loading / empty / error 状态。

如果项目中已经存在相似实现，应优先复用，而不是重新设计一套。

例如：

- 已经存在相同类型的排序控件 → 复用其交互方式。
- 已经存在相同类型的切换动画 → 复用其 duration、easing 和移动方式。
- 已经存在相同类型的 Card → 复用其视觉结构。
- 已经存在相同类型的数据加载方式 → 保持一致。
- 已经存在移动端适配方案 → 延续现有方案。

项目现有实现优先于通用最佳实践。

---

# 4. shadcn Usage Rules

项目 UI 应优先使用现有 shadcn/ui 体系。

但是：

`frontend/src/components/ui` 本身只读，禁止编辑。

业务层应通过组合 shadcn 组件实现需求，而不是修改基础组件。

优先顺序：

1. 使用现有业务组件。
2. 使用现有 wrapper。
3. 组合现有 shadcn 组件。
4. 在业务目录创建新的业务组件。
5. 最后才考虑新增其他基础设施。

禁止：

- 为已有 shadcn 能实现的功能重新手写一套基础组件。
- 同一个项目中创建多个视觉和交互完全不同的同类控件。
- 因为当前需求而引入另一套 UI Component Library。

---

# 5. UI / UX Consistency

所有 UI 修改必须尊重现有设计语言。

同类型组件应保持统一：

- border radius
- padding
- spacing
- font size
- font weight
- hover
- active
- selected
- focus
- disabled
- transition
- animation duration
- easing
- icon size
- alignment

不要因为当前任务创建新的交互语言。

如果需求没有明确要求重新设计某个控件，应延续已有样式。

---

# 6. Animation Rules

添加或修改动画前，先搜索项目中是否已经存在相似动画。

如果存在，应优先复用：

- transition duration
- easing
- translate distance
- opacity behavior
- hover behavior
- press behavior
- selected behavior

禁止为了一个页面单独建立完全不同的动画体系。

动画必须：

- 不影响布局稳定性。
- 不造成明显跳动。
- 不产生不必要的 layout shift。
- 不阻碍用户点击。
- 不破坏移动端操作。
- 不导致控件状态与视觉状态不同步。

---

# 7. Responsive Design

任何涉及 UI 的修改都必须考虑：

- desktop
- tablet（如果现有项目支持）
- mobile

禁止只让桌面端正常。

至少检查：

- 是否发生横向溢出。
- 文本是否异常换行。
- 按钮是否被挤压。
- 卡片是否超出视口。
- 弹窗是否超出屏幕。
- 图片是否溢出。
- 固定宽度是否影响移动端。
- hover-only 功能在触摸设备是否仍可使用。
- 交互元素是否有足够可点击区域。

不要为了移动端完全重写桌面结构，优先使用现有 responsive pattern。

---

# 8. Data and Business Logic

除非任务明确要求，否则不得修改：

- 数据库 schema。
- 数据表。
- API contract。
- authentication。
- authorization。
- token 行为。
- storage 规则。
- 数据字段含义。
- 数据迁移逻辑。

UI 修改不应顺带修改数据层。

如果当前问题只是展示问题，应优先在展示层解决。

---

# 9. Bug Fixing Rules

处理 bug 时，不要立即添加 patch。

必须先：

1. 尝试理解或复现问题。
2. 找到问题发生位置。
3. 分析根因。
4. 检查是否由近期代码变化引起。
5. 查找项目内是否有正确实现可参考。
6. 找出影响范围最小的修复方案。
7. 修复后验证相关使用场景。

禁止：

- 通过不断增加 CSS specificity 掩盖问题。
- 不理解原因直接加入 `!important`。
- 加入重复状态变量绕过现有逻辑。
- 使用 timeout 等方式掩盖 race condition，除非这是经过分析后的正确方案。
- 为了一个 bug 重写整个模块。

---

# 10. Before Coding

对于非极小修改，在开始编辑代码前应完成以下调查：

1. 阅读相关文件。
2. 找到入口组件。
3. 找到相关子组件。
4. 找到数据来源。
5. 搜索项目内相似实现。
6. 判断修改可能影响哪些页面或组件。
7. 判断是否存在更小的实现方式。

对于复杂任务，应先形成实施方案。

方案至少应明确：

- 问题是什么。
- 根因或当前结构是什么。
- 哪些文件需要修改。
- 哪些已有组件可以复用。
- 哪些文件不应该修改。
- 实现步骤。
- 潜在回归风险。
- 验证方式。

---

# 11. Modification Budget

默认认为所有任务都有有限的 Modification Budget。

优先：

1. 修改现有代码。
2. 复用现有组件。
3. 复用现有函数。
4. 复用现有 CSS / design token。
5. 使用少量新代码完成需求。

除非确有必要，不得：

- 新增架构层。
- 大规模移动文件。
- 大规模拆分组件。
- 大规模合并组件。
- 引入新的状态管理方案。
- 引入新的 UI 框架。
- 替换现有依赖。
- 修改公共接口。
- 重构与任务无关的模块。

如果一个局部需求产生大量无关 diff，应重新评估方案。

---

# 12. Dependency Rules

不要因为可以使用某个新库，就自动添加依赖。

新增 dependency 前必须判断：

- 项目是否已有相同能力。
- 是否可以使用现有依赖完成。
- 是否值得为了当前功能增加长期维护成本。

除非任务明确要求或确有必要，否则不要：

- 添加新的 UI library。
- 添加新的 animation library。
- 添加新的 state management library。
- 添加新的 utility library。

---

# 13. File Scope

修改开始前，应尽可能明确预计涉及的文件。

如果实现过程中突然需要修改大量原本无关文件，应暂停并重新分析。

不要通过跨项目大范围修改来解决局部问题。

特别注意：

`frontend/src/components/ui/**`

永远不属于允许修改范围。

---

# 14. Preserve Existing Behavior

当前任务没有要求改变的行为，应视为必须保持。

包括但不限于：

- 点击行为。
- keyboard behavior。
- hover 行为。
- selected 状态。
- loading 行为。
- 页面跳转。
- URL 参数。
- breadcrumb。
- title。
- filter。
- sort。
- search。
- responsive behavior。
- animation。
- authentication。
- data loading。
- cache behavior。

“视觉优化”不代表允许改变业务行为。

“重构”不代表允许改变用户可见行为。

---

# 15. Validation

完成代码修改后，不得直接宣布完成。

必须根据项目现有工具执行适用的验证。

优先执行：

- lint
- typecheck
- tests
- build

如果项目中存在对应命令，应运行现有命令，而不是自行创造另一套检查方式。

如果某项验证失败：

1. 阅读完整错误信息。
2. 判断错误是否由当前修改引起。
3. 修复与当前任务相关的问题。
4. 重新执行失败的检查。
5. 持续修复和验证，直到相关检查通过。

不得在存在当前修改引起的 lint、typecheck、test 或 build 错误时宣布任务完成。

如果某项无法运行，应在最终报告中明确说明原因。

---

# 16. UI Validation

涉及 UI 时，还需要检查与当前修改相关的：

- desktop
- mobile
- hover
- active
- selected
- focus
- disabled
- loading
- empty state
- error state
- long text
- short text
- overflow

只检查与当前需求相关的状态，不需要为了简单修改无意义地遍历整个项目。

---

# 17. Diff Review

完成实现和测试后，必须重新审查 git diff。

逐项确认：

1. 每一处修改是否都服务于当前任务？
2. 是否误改了无关文件？
3. 是否存在无关格式化？
4. 是否存在调试代码？
5. 是否存在 console 输出？
6. 是否存在临时代码？
7. 是否存在重复逻辑？
8. 是否存在可以复用但没有复用的代码？
9. 是否改变了任务没有要求改变的行为？
10. 是否可能产生桌面端或移动端回归？
11. 是否意外修改 `frontend/src/components/ui/**`？

如果发现问题，应直接修复并重新验证。

在 commit 前必须再次确认最终 diff。

---

# 18. Read-Only Directory Final Check

在任何任务完成前，必须确认：

`frontend/src/components/ui/**`

没有发生任何修改。

如果 git diff 中出现该目录的改动，应撤销这些改动，并使用业务层实现替代方案。

这是强制规则，不允许因为当前任务需要而例外。

只有用户明确修改本 `AGENTS.md` 并解除该限制后，才允许编辑该目录。

---

# 19. Avoid Overengineering

实现应与任务复杂度匹配。

一个简单的视觉修改不应该：

- 引入新的 context。
- 建立新的 store。
- 新建大量抽象。
- 创建复杂配置系统。
- 创建泛型框架。
- 重构整个组件树。

优先简单、明确、易维护的实现。

只有在多个现有场景确实存在重复需求时才考虑抽象。

---

# 20. Comments

不要加入解释显而易见代码的注释。

应只在以下情况增加注释：

- 非显然业务规则。
- 特殊兼容逻辑。
- 容易被未来开发者误改的约束。
- 不得不采用的 workaround。

不要通过大量注释弥补代码结构问题。

---

# 21. Error Handling

不得因为新需求删除现有错误处理。

新增异步逻辑时应处理：

- loading
- success
- failure

但不要为了理论上的极端情况构建复杂、项目内从未采用过的 error architecture。

沿用项目现有错误处理方式。

---

# 22. Performance

不要进行没有证据的 premature optimization。

但应避免明显性能问题，例如：

- 不必要的重复请求。
- render 中进行昂贵计算。
- 无意义重复遍历大型数据。
- 不必要重复加载图片。
- 不必要重复创建 listener。
- 未清理 event listener。
- 由于状态设计导致明显重复渲染。

如果项目已有 cache / preload / lazy loading 方案，应优先延续现有方案。

---

# 23. Accessibility

不要破坏现有可访问性。

交互元素优先使用语义化组件。

不得为了视觉效果：

- 去掉 keyboard interaction。
- 去掉 focus 行为。
- 使用不可点击元素模拟按钮而不提供正确交互。
- 删除必要的 aria 信息。

沿用 shadcn/Radix 已提供的可访问性能力。

---

# 24. Security and Privacy

不得因为 UI 或开发便利削弱现有安全和隐私策略。

未经明确要求，不得：

- 暴露隐藏数据。
- 绕过认证。
- 绕过权限检查。
- 将服务端密钥写入前端。
- 输出敏感 token。
- 修改邀请码或授权逻辑。
- 将原本私有的数据公开。

---

# 25. Git Commit and Push

每次任务完成后，都必须将本次任务产生的有效修改提交并推送到当前 Git 远程仓库。

推送不是可选步骤，而是任务完成流程的一部分。

标准流程：

1. 完成代码修改。
2. 完成所有必要验证。
3. 审查最终 `git diff`。
4. 确认没有无关修改。
5. 确认 `frontend/src/components/ui/**` 没有被修改。
6. 检查 `git status`。
7. 将当前任务需要提交的文件加入 staging area。
8. 创建清晰、准确的 commit。
9. 将 commit push 到当前分支对应的远程分支。
10. 确认 push 成功。
11. 再次检查 repository 状态。

## 25.1 Commit Rules

commit message 应：

- 简洁描述当前任务。
- 与实际修改内容一致。
- 不夸大修改范围。
- 不使用无意义信息，例如 `update`、`changes`、`fix stuff`。

如果项目已有 commit message 风格，应沿用现有风格。

不要为了创建 commit 而加入与当前任务无关的文件。

不要覆盖、删除或重写用户已有但与当前任务无关的未提交修改。

如果工作区中已经存在用户自己的修改，应首先识别本任务产生的修改，并避免误提交其他修改。

## 25.2 Push Is Mandatory

任务完成后必须执行 push。

不得因为：

- “代码已经修改完成”
- “测试已经通过”
- “commit 已创建”
- “本地状态正常”

而省略 push。

只有远程推送成功后，当前任务才可以视为真正完成。

## 25.3 Push Failure Handling

如果 push 失败，不得立即结束任务。

必须阅读错误信息并判断原因。

可能情况包括但不限于：

- remote branch 落后。
- non-fast-forward。
- upstream 未设置。
- branch 配置错误。
- merge conflict。
- rebase conflict。
- authentication 问题。
- remote 配置问题。
- pre-push hook 失败。
- lint / test hook 失败。
- 网络或 Git transport 错误。

对于可以在当前开发环境中安全解决的问题，应继续处理直到 push 成功。

处理原则：

1. 阅读完整报错。
2. 判断失败原因。
3. 检查当前 branch 和 remote 状态。
4. 使用不会破坏用户已有工作的安全方式解决。
5. 如需要同步远程更新，优先检查远程变化后再进行 pull/rebase/merge。
6. 出现 conflict 时应理解双方修改后正确解决，不得简单丢弃远程或本地代码。
7. 解决后重新运行必要验证。
8. 必要时重新 commit。
9. 再次 push。
10. 重复此流程，直到正常推送。

不得使用以下方式粗暴解决 push 问题：

- 无分析直接 `git reset --hard`。
- 删除用户修改。
- 删除远程提交。
- 强制覆盖他人工作。
- 为了消除冲突直接选择全部 ours 或全部 theirs。
- 未经明确需要使用 destructive Git commands。

## 25.4 Force Push

默认禁止 force push。

不得使用：

`git push --force`

或：

`git push -f`

除非用户明确要求。

如果确实存在必须重写远程历史的场景，应优先使用：

`git push --force-with-lease`

但仍必须仅在明确确认不会覆盖他人提交时使用。

正常任务不应通过 force push 解决问题。

## 25.5 Push Verification

push 命令返回成功后，还应确认：

- 当前 branch 正确。
- upstream 正确。
- 本地 HEAD 对应预期 commit。
- 本地与对应 remote branch 已同步。
- 没有遗漏本任务应提交的修改。

如果存在任务产生但尚未 commit/push 的必要修改，则任务仍未完成。

---

# 26. Completion Criteria

任务只有满足以下条件才可以认为完成：

- 当前需求已经实现。
- 未修改需求之外的功能。
- 未修改 `frontend/src/components/ui/**`。
- 已复用适当的现有实现。
- 没有明显重复或临时代码。
- 相关 lint/typecheck/test/build 已执行。
- 相关检查不存在由当前任务引起的错误。
- 相关 UI 状态已检查。
- 桌面端与移动端没有明显回归。
- git diff 已重新审查。
- 无无关修改。
- 当前任务的修改已经正确 commit。
- 当前任务对应 commit 已成功 push 到远程仓库。
- push 不存在未解决错误。
- 本地与目标远程分支状态正常。

**未成功 push，不得宣布任务完成。**

---

# 27. Final Git Check

在输出最终报告之前，必须执行一次最终 Git 状态检查。

至少确认：

- 当前 branch。
- 当前 HEAD。
- `git status`。
- 当前任务 commit 已存在。
- 当前任务 commit 已 push。
- 本地没有遗漏本任务产生的必要修改。
- `frontend/src/components/ui/**` 无修改。

如果发现任何本任务尚未提交或尚未推送的必要修改，应继续处理，不得直接结束。

---

# 28. Completion Report

完成任务后，最终报告应简洁说明：

## Changes

修改了什么。

## Files

修改了哪些文件。

## Implementation

核心实现方式，以及复用了哪些现有实现。

## Validation

运行了哪些检查，以及结果。

## Git

说明：

- commit 是否成功。
- commit hash 或简短 commit id。
- push 是否成功。
- 推送到哪个 branch。

## Notes

如果存在：

- 尚未验证的部分。
- 已知限制。
- 潜在问题。
- 发现但没有修改的无关问题。

应在这里说明。

不得在 push 尚未成功时使用“已完成”“完成”“done”等表述。

---

# 29. Priority

发生规则冲突时，优先级如下：

1. 用户当前任务中的明确要求。
2. 本 `AGENTS.md` 中的安全、只读、数据保护规则。
3. 本 `AGENTS.md` 中的 Git 安全规则。
4. 本 `AGENTS.md` 中的项目开发规则。
5. 当前项目已有代码和设计模式。
6. 通用工程最佳实践。

但是即使用户要求普通 UI 修改，也不得自动认为允许编辑：

`frontend/src/components/ui/**`

如果用户确实希望修改该目录，应要求其明确解除本文件中的只读限制。

同样，普通任务不得自动认为允许 force push、删除远程历史或丢弃用户已有修改。

---

# 30. General Working Philosophy

在这个项目中：

- 先理解，再修改。
- 先复用，再创造。
- 先寻找根因，再 patch。
- 优先小 diff。
- 保持行为稳定。
- 保持视觉一致。
- 不擅自扩大任务范围。
- 不因“最佳实践”推翻已有成熟实现。
- 不以重构本身作为目标。
- 所有修改都应该能够明确解释其与当前需求的关系。
- 修改完成不等于任务完成。
- 测试通过不等于任务完成。
- commit 完成不等于任务完成。
- **成功 push 到远程仓库后，任务才可以视为完成。**

# 编日史（classRecord）

一个基于 **纯静态前端** 的班级档案项目，用于整理与检索三类内容：

- 🗓️ **记录（Record）**：按日期沉淀事件
- 👥 **人物（People）**：维护人物基础信息与关联记录
- 📚 **术语（Glossary）**：维护班级内部词条与来源

项目不依赖后端服务，适合直接部署到任意静态托管平台（如 GitHub Pages、Nginx 静态目录、对象存储静态站点等）。

---

## 1. 核心能力概览

- **纯静态架构**：`HTML + CSS + JavaScript + JSON`，开箱即用。
- **统一缓存加载器**：`loadWithCache` + `Store` 结构，首屏后访问更快。
- **访问密钥机制**：前端 SHA-256 校验 + 24 小时有效期。
- **跨页面联动**：记录中的人物/术语可直接跳转至详情页。
- **数据驱动渲染**：通过 `*_index.json` 管理实体文件列表，便于协作更新。
- **可维护的文本标记语法**：支持人物标记、术语标记、黑幕、上下标等。

---

## 2. 页面与功能说明

| 页面 | 路径 | 作用 |
|---|---|---|
| 导览页 | `index.html` | 展示总量统计、答题入口、缓存进度 |
| 记录页 | `record.html` | 展示全部记录，支持年月日筛选 |
| 人物列表页 | `people.html` | 分角色展示人物，支持按 id/参与事件数/记录事件数排序 |
| 人物详情页 | `person.html?id=xxx` | 展示人物信息，切换“参与事件/记录事件”并筛选 |
| 术语列表页 | `glossary.html` | 展示术语表，支持按起源时间/术语 id 排序 |
| 术语详情页 | `term.html?id=xxx` | 展示术语定义、相关人物、关联记录 |
| 答题页 | `quiz.html` | 从档案数据生成题目，答对获得 Q币 |
| 授权页 | `auth.html` | 输入访问密钥并写入授权状态 |
| 文档页 | `docs/record-format.html` | 记录 JSON 字段与标记格式说明 |

---

## 3. 目录结构

```text
classRecord/
├── index.html                  # 导览入口
├── record.html                 # 记录列表
├── people.html                 # 人物列表
├── person.html                 # 人物详情
├── glossary.html               # 术语列表
├── term.html                   # 术语详情
├── auth.html                   # 授权页
├── style.css                   # 全局样式
├── js/
│   ├── authGate.js             # 访问控制与密钥校验
│   ├── authPage.js             # 授权页逻辑
│   ├── authControls.js         # “移除密钥”等操作
│   ├── cacheLoader.js          # 通用缓存加载器
│   ├── recordStore.js          # 记录数据加载与 Store
│   ├── peopleStore.js          # 人物数据加载与 Store
│   ├── glossaryStore.js        # 术语数据加载与 Store
│   ├── qcoinSystem.js          # 答题奖励、余额与解锁状态
│   ├── recordRenderer.js       # 记录渲染、标记解析、筛选组件
│   ├── guide.js                # 导览页统计与进度
│   ├── script.js               # 记录页初始化
│   ├── people.js               # 人物列表页逻辑
│   ├── person.js               # 人物详情页逻辑
│   ├── glossary.js             # 术语列表页逻辑
│   └── term.js                 # 术语详情页逻辑
├── data/
│   ├── record/                 # 记录数据 + records_index.json
│   ├── people/                 # 人物数据 + people_index.json
│   ├── glossary/               # 术语数据 + glossary_index.json
│   └── attachments/            # 记录附件
├── images/                     # 记录主图
└── docs/
    └── record-format.html      # 记录格式说明
```

---

## 4. 快速启动

> 请勿直接双击 HTML 文件以 `file://` 打开；浏览器会限制 `fetch` 读取本地 JSON。

在仓库根目录启动静态服务器：

```bash
python3 -m http.server 8000
```

浏览器访问：

```text
http://localhost:8000/index.html
```

---

## 5. 访问控制（auth）

访问控制入口在 `js/authGate.js`：

- 默认密钥哈希保存在 `DEFAULT_KEY_HASH`。
- 页面访问时会检查：
  1. `localStorage.classRecordAccessGranted === 'true'`
  2. `localStorage.classRecordAccessGrantedAt` 是否在 24 小时有效期内
- 未授权时会自动跳转到 `auth.html`。
- 授权成功后会回跳到访问前页面（通过 `sessionStorage` 记录 target）。

### 自定义密钥方式

可在页面中提前挂载全局变量：

```html
<script>
  window.CLASS_RECORD_ACCESS_KEY_HASH = "你的sha256十六进制小写";
</script>
<script src="js/authGate.js"></script>
```

> 注意：前端哈希仅用于“轻量访问门槛”，不是强安全方案。请勿在前端保存高敏感信息。

---

## 6. 缓存机制与刷新策略

缓存由 `js/cacheLoader.js` 统一管理：

- 页面生命周期内使用内存缓存，避免重复解析大批 JSON。
- 同一资源的并发加载会自动合并，避免重复请求。
- 持久缓存交给浏览器 HTTP 缓存，不再把 record/people/glossary 数据写入 `localStorage`。
- 仅保留访问态、Q币、成就、当前背景等必要小状态。

### 首次进入行为

导览页会调用 `ensureAllCachesLoaded()` 批量预热缓存：

1. 拉取三个 index 文件计算总步数
2. 分批加载 record/people/glossary 数据
3. 更新进度条并展示统计卡片

### 手动清理

- 首页右上角“🧹 清空缓存”按钮
- 或调用 `window.clearCache()`
- “🔒 移除密钥”会同时移除授权并清理项目缓存

---

## 7. 数据文件规范

## 7.1 记录（`data/record/*.json`）

推荐文件名：`YYYY-MM-DD-序号.json`

常用字段：

- `date`（必填）：`YYYY-MM-DD`
- `time`（可选）：`HH:MM`
- `author`（必填）：人物 id
- `content`（必填）：正文（支持标记语法）
- `image`（必填）：主图路径（通常 `images/*.jpg`）
- `attachments`（可选）：附件数组
- `importance`（可选）：记录重要级别（未填默认 `normal`）

示例：

```json
{
  "date": "2024-11-20",
  "time": "",
  "author": "shr",
  "content": "[[zhx|qq哥]]...",
  "image": "images/2024-11-20-01.jpg",
  "attachments": [
    {
      "name": "情书.jpg",
      "file": "data/attachments/2024-11-20-01-love.jpg"
    }
  ]
}
```

新增记录后，务必同步更新：`data/record/records_index.json`

## 7.2 人物（`data/people/*.json`）

常用字段：

- `id`：人物唯一 id（如 `zhx`）
- `alias`：别名/称呼（支持标记语法）
- `role`：`student` / `teacher` / `other`
- `bio`：简介

示例：

```json
{
  "id": "zhx",
  "alias": "qb",
  "role": "student",
  "bio": "生物课代表"
}
```

新增人物后，务必同步更新：`data/people/people_index.json`

## 7.3 术语（`data/glossary/*.json`）

常用字段：

- `id`：术语 id
- `term`：术语展示文本
- `definition`：定义/来源描述
- `since`：起源日期（建议 `YYYY-MM-DD`）
- `relatedPeople`：相关人物 id 数组

示例：

```json
{
  "id": "boom",
  "term": "“嫌多就别做，废物！”",
  "definition": "...",
  "since": "2024-12-18",
  "relatedPeople": ["ljy", "jyr"]
}
```

新增术语后，务必同步更新：`data/glossary/glossary_index.json`

---

## 8. 记录正文标记语法（content）

由 `recordRenderer.js` 统一解析：

- 人物：`[[id|显示文本]]`
- 术语：`{{termId|显示文本}}`
- 黑幕：`((隐藏内容))`
- 上标：`^text^`
- 下标：`_text_`
- 居中独立段：`!!居中文字!!`
- 箭头注记：`->[上方文字||下方文字]<-`

示例：

```text
[[zhx|qq哥]] 说 {{boom|“嫌多就别做”}}，化学式 CO_2_ 和 F^-^。
!!居中显示的文字!!
记录中出现 ->[上方说明||下方说明]<- 这样的箭头注记。
```

---

## 9. 页面数据联动关系

- **record → person**：`[[id|...]]` 点击跳转 `person.html?id=id`
- **record → term**：`{{termId|...}}` 点击跳转 `term.html?id=termId`
- **person 详情页**：
  - 参与事件：从记录 `content` 中匹配 `[[personId|...]]`
  - 记录事件：从记录 `author` 匹配 `personId`
- **term 详情页**：
  - 关联记录：从记录 `content` 中匹配 `{{termId|...}}`
  - 相关人物：由 `relatedPeople` 映射

---

## 10. 常见维护流程

### 新增一条记录

1. 在 `data/record/` 新建 JSON。
2. 放置主图到 `images/`，附件到 `data/attachments/`（如有）。
3. 更新 `records_index.json`。
4. 本地打开网站后点击“清空缓存”并刷新验证。

### 新增一个人物

1. 在 `data/people/` 新建 JSON。
2. 更新 `people_index.json`。
3. 到记录中使用 `[[id|显示名]]` 建立关联。

### 新增一个术语

1. 在 `data/glossary/` 新建 JSON。
2. 更新 `glossary_index.json`。
3. 到记录中使用 `{{termId|显示名}}` 建立关联。

---

## 11. 部署建议

- 仅需静态托管，不需要 Node/Python 运行时。
- 如部署在子路径（例如 `/classRecord/`），建议确保各页面与 JSON 路径按当前相对路径结构可访问。
- 修改数据后如用户端未即时更新，多数是缓存导致，可提示用户使用页面按钮清理缓存。

---

## 12. 已知限制

- 访问密钥在前端校验，安全性有限。
- 大规模数据下首次预热会有等待时间（后续依赖缓存改善）。
- 标记解析基于正则，建议避免在极端嵌套文本中混用复杂标记。

---

## 13. 贡献建议

- 新增数据时，保证 JSON 字段命名一致。
- 提交前至少检查：
  - 页面可正常打开
  - 新增条目可被检索/跳转
  - 清理缓存后仍可正常加载
- 文案建议保持客观、清晰、可追溯。

欢迎继续完善本项目文档、数据规范与前端交互体验。

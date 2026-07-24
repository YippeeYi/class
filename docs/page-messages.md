# 书面记录页箴言

箴言文件存放在 `private-assets/content/messages/`，每页使用独立 JSON 文件，文件名必须与书面记录页码一致。例如 `private-assets/content/messages/01.json`：

```json
{
  "content": "写给这一页的箴言。",
  "author": "记录人 id"
}
```

- `content`：箴言正文，支持与普通记录相同的文本标记语法。
- `author`：记录人的人物 `id`。
- 没有对应 JSON 的书面页不会渲染箴言或空占位。

添加或更新箴言后，执行 `npm run upload-private-content` 将数据迁移至 `class_page_messages`。

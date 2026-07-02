# 书面记录页寄语

寄语文件存放在 `data/messages/`，每页使用独立 JSON 文件，文件名必须与书面记录页码一致。例如 `data/messages/01.json`：

```json
{
  "content": "写给这一页的寄语。",
  "author": "记录人 id"
}
```

- `content`：寄语正文，支持与普通记录相同的文本标记语法。
- `author`：记录人的人物 `id`。
- 没有对应 JSON 的书面页不会渲染寄语或空占位。

添加或更新寄语后，执行 `node scripts/migrate-secure-content.mjs` 将数据迁移至 `class_page_messages`。

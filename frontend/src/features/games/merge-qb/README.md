# 合成大QB素材与碰撞体

当前有 11 个等级。默认素材是本项目生成的透明 PNG 占位图，没有使用第三方游戏图片。按下表替换同名文件即可换图；等级顺序、分值和升级目标都在 [`levels.ts`](./levels.ts) 的 `QB_LEVELS` 中。

| 等级 | 名称 | 素材文件 |
| --- | --- | --- |
| 01 | 一级 QB | `frontend/public/games/merge-qb/01.png` |
| 02 | 二级 QB | `frontend/public/games/merge-qb/02.png` |
| 03 | 三级 QB | `frontend/public/games/merge-qb/03.png` |
| 04 | 四级 QB | `frontend/public/games/merge-qb/04.png` |
| 05 | 五级 QB | `frontend/public/games/merge-qb/05.png` |
| 06 | 六级 QB | `frontend/public/games/merge-qb/06.png` |
| 07 | 七级 QB | `frontend/public/games/merge-qb/07.png` |
| 08 | 八级 QB | `frontend/public/games/merge-qb/08.png` |
| 09 | 九级 QB | `frontend/public/games/merge-qb/09.png` |
| 10 | 十级 QB | `frontend/public/games/merge-qb/10.png` |
| 11 | 大 QB | `frontend/public/games/merge-qb/11.png` |

建议每张图为 **256×256 px 的透明 PNG**，角色居中且可见边缘靠近画布边缘。WebP 也可以，但需同时改该等级的 `image` 文件名。游戏没有必需的背景图、音效或其他素材；棋盘背景直接使用站点主题色。

每一级独立设置 `visualSize`（画面绘制宽高）、`physicsSize`（碰撞坐标的宽高）和 `collider.shapes`。碰撞形状坐标以原图左上角 `(0, 0)`、右下角 `(1, 1)` 归一化保存，不随浏览器尺寸变化。`circle` 的 `x/y` 是圆心、`radius` 是相对宽高较小边的半径；`rectangle` 的 `x/y` 是中心、`width/height` 是相对宽高；`polygon.vertices` 是轮廓顶点数组。可在 `shapes` 中放多个圆、矩形或凸多边形近似不规则轮廓。不要输入凹多边形、极尖或极薄的形状；应拆成几个有少量重叠的凸形状。游戏会拒绝凹多边形，而非悄悄改为外接凸包。

示例（只展示碰撞相关字段）：

```ts
visualSize: { width: 85, height: 85 },
physicsSize: { width: 79, height: 83 },
collider: {
  shapes: [
    { type: 'polygon', vertices: [
      { x: 0.22, y: 0.12 }, { x: 0.78, y: 0.12 },
      { x: 0.91, y: 0.52 }, { x: 0.70, y: 0.91 },
      { x: 0.28, y: 0.91 }, { x: 0.09, y: 0.52 },
    ] },
  ],
},
```

换成最终 QB 图片后逐级检查：图片透明留白是否过大、碰撞边界是否贴近可见轮廓、堆叠是否稳定。优先调该级的 `collider` 和 `physicsSize`；无需修改 `game.ts` 或画布组件。

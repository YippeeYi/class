# 合成大QB素材与物理配置

11 张原始 PNG 位于本目录的 `01.png` 至 `11.png`，已由 `.gitignore` 排除；不要移入 `frontend/public` 或导入到前端包。`scripts/admin.mjs` 将它们列入现有内容发布清单，目标是私有 bucket `classrecord-private` 的 `images/games/merge-qb/01.png` 至 `11.png`。先应用 `20261001000000_private_merge_qb_images.sql`，再运行现有 `npm run content:audit`、`npm run content:plan` 和发布流程。前端通过现有邀请码鉴权、Storage RLS 和短时签名 URL 读取，并在每次进入游戏时预加载一次。

[`levels.ts`](./levels.ts) 的 `QB_LEVELS` 集中保存等级顺序、积分、原图尺寸、显示尺寸、碰撞轮廓和每级 `mass`。当前轮廓由这 11 张 PNG 的 alpha >= 64 区域提取，简化为最多 12 点的凸包；`visualSize`/`physicsSize` 依据可见主体的最大边确定，保持原图比例。轮廓坐标相对完整原图左上角归一化为 0 至 1。换图后要重新测量透明轮廓、更新配置并逐级验收；不要修改原图像素。

`QB_PHYSICS.qb` 定义 QB 材质，`QB_PHYSICS.wall` 定义边缘材质。Matter.js 将接触双方的 `friction` 取较小值作为动摩擦，将 `frictionStatic` 取较大值作为静摩擦乘数；静摩擦力计算还受法向力影响，因此两类接触不能用两个完全独立的系数精确指定。`frictionAir` 是空气阻尼，`restitution` 是反弹系数。每级 `mass` 通过 `Body.setMass` 直接设置，显示尺寸改变不会自动改变最终质量。`QB_OUTLINE.widthCssPx` 是画布中所有实际 QB 共用的屏幕描边宽度；它只影响绘制，不扩大碰撞体。

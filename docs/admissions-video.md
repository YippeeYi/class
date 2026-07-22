# 蹭饭图视频

视频使用网页同一 RPC 数据源和本地 `maps/china-provinces.geojson`。它固定为 1920×1080、30 fps；Playwright 在每一个固定时间点截帧，FFmpeg 合成 H.264 MP4，不依赖电脑实际播放速度。

先在一个终端启动站点：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

另一个终端设置仅本机使用的有效访问 token（不写进命令历史、Git 或日志），再运行：

```powershell
$env:CLASS_RECORD_ACCESS_TOKEN='本机已有的64位访问令牌'
node scripts/render-admissions-video.mjs
```

首次准备开发环境后，安装 Chromium 运行时，并确认 FFmpeg 在 PATH 中：

```powershell
npx playwright install chromium
ffmpeg -version
```

渲染脚本会在开始前检查 Playwright、Chromium、FFmpeg 和有效的本机访问 token；缺少任一项会以明确错误停止，不会生成不完整视频。输出为被 Git 忽略的 `admissions-output/class-admissions-map.mp4`，临时帧在 `admissions-frames/`；确认成片后可删除临时帧。当前页面会在取得地图文件和私有数据后提供 `ClassAdmissionsVideo.seek()` 确定性时间轴；每省时长根据大学数量计算，渲染脚本不打印 token、签名 URL 或学生信息。

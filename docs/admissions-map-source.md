# 蹭饭图地图资源

本仓库**未附带**中国省级边界矢量文件。当前没有可核验许可、版本和校验值的省级 GeoJSON；为了避免把来源不明地图伪装成合规数据，页面会在缺少文件时明确停止加载，而不会绘制简化或改造过的国界。

管理员应从自然资源部标准地图服务系统取得经确认可用于该交互场景的省级矢量数据，或取得该系统/有资质单位书面提供的矢量文件。标准地图服务说明其下载地图依据国界线画法标准编制，直接使用的标准地图需标注审图号；该站常见公开下载格式为 JPG/EPS，不能把其图片自动描边成 GeoJSON。来源入口：[自然资源部标准地图服务系统](https://bzdt.tianditu.gov.cn/)。获取日期、审图号、版本和许可条件必须由下载人填写到下表。

已提供的 `maps/china-provinces.geojson` 来源记录在 `maps/SOURCE.md`。该天地图下载使用 `properties.gb`（格式为 `156` 加六码行政区代码）而非 `adcode`；项目读取层会将其规范化为六码代码，且只使用面要素，完全不改写原始 GeoJSON。

将审核后的原始 GeoJSON 放在 `maps/china-provinces.geojson`（部署时作为本地静态文件），并新增 `maps/china-provinces.geojson.provenance.json`：

```json
{
  "sourceName": "自然资源部标准地图服务系统 / 已获授权矢量数据",
  "sourceUrl": "https://bzdt.tianditu.gov.cn/",
  "retrievedAt": "2026-07-21",
  "version": "填写数据版本或审图号",
  "licenseOrApproval": "填写适用许可或审批信息",
  "sha256": "原始文件 SHA-256",
  "localPath": "maps/china-provinces.geojson"
}
```

文件必须为经纬度 GeoJSON `FeatureCollection`，每个省级面 `Feature` 的 `properties` 必须包含 `name`，并包含六位 `adcode` 或天地图格式 `gb: 156<六码代码>`。不要自行修改港澳台、南海诸岛、国界或省界；页面会按该文件原样渲染。部署前以权威标准地图人工比对，并按数据许可要求处理审图号/署名。

市级边界可另放在 `maps/china-cities.geojson`。它只用于省份聚焦时的市界线，不替代省级边界；同样必须保留原始数据，并使用与省级图相同的经纬度坐标系和来源记录。运行时按省级行政区代码的前两位筛选市级面；北京市、天津市、上海市、重庆市及港澳特别行政区不绘制市级边界。

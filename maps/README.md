# 中国行政区边界文件放置位置

将经审核、带完整来源记录的 `china-provinces.geojson` 与其
`china-provinces.geojson.provenance.json` 放在本目录。详细字段和合规要求见
[`docs/admissions-map-source.md`](../docs/admissions-map-source.md)。

本目录不含任何替代性、手绘或来源不明的地图数据。

`china-cities.geojson` 为市级行政区面数据。蹭饭图仅在省份聚焦时按需加载它：普通省份绘制市界，直辖市及港澳特别行政区不绘制市界。该文件需保持与省级数据相同的经纬度坐标系；每个面要素应提供 `name` 与六位 `adcode`，或天地图格式的 `gb: 156<六码行政区代码>`。

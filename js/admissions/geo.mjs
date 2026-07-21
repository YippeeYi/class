const mapUrl = 'maps/china-provinces.geojson';
const number = (value) => Number(value);
export const loadGeo = async () => {
  const response = await fetch(mapUrl, { cache: 'force-cache', credentials: 'same-origin' });
  if (!response.ok) throw new Error('未找到经审核的省级地图文件。请按 docs/admissions-map-source.md 配置 maps/china-provinces.geojson。');
  const geo = await response.json();
  if (geo?.type !== 'FeatureCollection' || !Array.isArray(geo.features)) throw new Error('地图文件格式错误：应为 GeoJSON FeatureCollection。');
  const features = geo.features.filter((feature) => ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type)).map((feature) => ({ ...feature, code: String(feature.properties?.adcode || ''), name: String(feature.properties?.name || '') }));
  if (!features.length || features.some((feature) => !/^\d{6}$/.test(feature.code) || !feature.name)) throw new Error('地图文件缺少 properties.adcode 或 properties.name。');
  return features;
};
const walkCoordinates = (coordinates, callback) => Array.isArray(coordinates?.[0]) ? coordinates.forEach((item) => walkCoordinates(item, callback)) : callback(coordinates);
export const boundsForFeatures = (features) => {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  features.forEach((feature) => walkCoordinates(feature.geometry.coordinates, ([x, y]) => { bounds[0] = Math.min(bounds[0], number(x)); bounds[1] = Math.min(bounds[1], number(y)); bounds[2] = Math.max(bounds[2], number(x)); bounds[3] = Math.max(bounds[3], number(y)); }));
  return bounds;
};
export const createProjection = (features, width, height, padding = 28) => {
  const [minX, minY, maxX, maxY] = boundsForFeatures(features); const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
  const offsetX = (width - (maxX - minX) * scale) / 2, offsetY = (height - (maxY - minY) * scale) / 2;
  return ([longitude, latitude]) => [offsetX + (longitude - minX) * scale, height - (offsetY + (latitude - minY) * scale)];
};
const ringPath = (ring, project) => ring.map((point, index) => `${index ? 'L' : 'M'}${project(point).map((value) => value.toFixed(2)).join(',')}`).join('') + 'Z';
export const featurePath = (feature, project) => (feature.geometry.type === 'Polygon' ? feature.geometry.coordinates : feature.geometry.coordinates.flat()).map((ring) => ringPath(ring, project)).join('');

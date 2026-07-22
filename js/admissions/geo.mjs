// Resolve from this module, not the document URL. This remains correct when a
// host serves admissions.html from an extensionless or nested route.
const mapUrl = new URL('../../maps/china-provinces.geojson', import.meta.url).href;
const cityMapUrl = new URL('../../maps/china-cities.geojson', import.meta.url).href;
const cityBoundaryCache = new Map();
const number = (value) => Number(value);
// Tianditu's administrative-division download encodes a provincial GB code as
// `156` + six-digit administrative code. Keep the original GeoJSON untouched
// and normalize this documented source representation at the read boundary.
export const featureAdcode = (feature) => {
  const properties = feature?.properties || {};
  const direct = String(properties.adcode || '').trim();
  if (/^\d{6}$/.test(direct)) return direct;
  const gb = String(properties.gb || '').trim();
  const match = /^156(\d{6})$/.exec(gb);
  return match ? match[1] : '';
};
export const loadGeo = async () => {
  // Do not reuse a previously cached 404 after the map is added to a new
  // deployment. The map is loaded once per protected page entry.
  const response = await fetch(mapUrl, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error(`未找到经审核的省级地图文件（HTTP ${response.status}）。请刷新到最新部署后重试。`);
  const geo = await response.json();
  if (geo?.type !== 'FeatureCollection' || !Array.isArray(geo.features)) throw new Error('地图文件格式错误：应为 GeoJSON FeatureCollection。');
  const features = geo.features.filter((feature) => ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type)).map((feature) => ({ ...feature, code: featureAdcode(feature), name: String(feature.properties?.name || '') }));
  if (!features.length || features.some((feature) => !/^\d{6}$/.test(feature.code) || !feature.name)) throw new Error('地图文件缺少 properties.adcode 或 properties.name。');
  return features;
};
export const isCityBoundaryProvince = (code) => !new Set(['110000', '120000', '310000', '500000', '810000', '820000']).has(String(code));
export const loadCityBoundaries = async (provinceCode) => {
  const code = String(provinceCode || '');
  if (!isCityBoundaryProvince(code)) return [];
  if (!cityBoundaryCache.has(code)) cityBoundaryCache.set(code, (async () => {
    const response = await fetch(cityMapUrl, { cache: 'force-cache', credentials: 'same-origin' });
    if (!response.ok) return [];
    const geo = await response.json();
    if (geo?.type !== 'FeatureCollection' || !Array.isArray(geo.features)) return [];
    return geo.features
      .filter((feature) => ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type))
      .map((feature) => ({ ...feature, code: featureAdcode(feature), name: String(feature.properties?.name || '') }))
      .filter((feature) => feature.code.startsWith(code.slice(0, 2)));
  })().catch(() => []));
  return cityBoundaryCache.get(code);
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

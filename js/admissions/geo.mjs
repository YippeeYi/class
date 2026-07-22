// Resolve from this module, not the document URL. This remains correct when a
// host serves admissions.html from an extensionless or nested route.
const mapUrl = new URL('../../maps/china-provinces.geojson', import.meta.url).href;
const cityMapUrl = new URL('../../maps/china-cities.geojson', import.meta.url).href;
const cityBoundaryCache = new Map();
let cityFeaturesPromise = null;
let provinceFeaturesPromise = null;
const number = (value) => Number(value);
const DEGREES_TO_RADIANS = Math.PI / 180;
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
  if (!provinceFeaturesPromise) provinceFeaturesPromise = fetch(mapUrl, { cache: 'no-store', credentials: 'same-origin' }).then(async (response) => {
    if (!response.ok) throw new Error(`未找到经审核的省级地图文件（HTTP ${response.status}）。请刷新到最新部署后重试。`);
    const geo = await response.json();
    if (geo?.type !== 'FeatureCollection' || !Array.isArray(geo.features)) throw new Error('地图文件格式错误：应为 GeoJSON FeatureCollection。');
    const features = geo.features.filter((feature) => ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type)).map((feature) => ({ ...feature, code: featureAdcode(feature), name: String(feature.properties?.name || '') }));
    if (!features.length || features.some((feature) => !/^\d{6}$/.test(feature.code) || !feature.name)) throw new Error('地图文件缺少 properties.adcode 或 properties.name。');
    return features;
  }).catch((error) => { provinceFeaturesPromise = null; throw error; });
  return provinceFeaturesPromise;
};
export const provinceNamesForCodes = async (codes) => {
  const requested = new Set((codes || []).map(String)); const names = new Map((await loadGeo()).filter((feature) => requested.has(feature.code)).map((feature) => [feature.code, feature.name]));
  const missing = [...requested].filter((code) => !names.has(code)); if (missing.length) throw new Error(`省级地图中未找到省份代码：${missing.join(', ')}。`);
  return names;
};
export const isCityBoundaryProvince = (code) => !new Set(['110000', '120000', '310000', '500000', '810000', '820000']).has(String(code));
const loadCityFeatures = async () => {
  if (!cityFeaturesPromise) cityFeaturesPromise = fetch(cityMapUrl, { cache: 'force-cache', credentials: 'same-origin' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`市级地图文件无法读取（HTTP ${response.status}）。`);
      const geo = await response.json();
      if (geo?.type !== 'FeatureCollection' || !Array.isArray(geo.features)) throw new Error('市级地图文件格式错误。');
      return geo.features.filter((feature) => ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type))
        .map((feature) => ({ ...feature, code: featureAdcode(feature), name: String(feature.properties?.name || '') }))
        .filter((feature) => /^\d{6}$/.test(feature.code) && feature.name);
    });
  return cityFeaturesPromise;
};
const polygonCenter = (ring) => {
  let twiceArea = 0, x = 0, y = 0;
  for (let index = 0; index < ring.length - 1; index += 1) { const [x1, y1] = ring[index], [x2, y2] = ring[index + 1], cross = x1 * y2 - x2 * y1; twiceArea += cross; x += (x1 + x2) * cross; y += (y1 + y2) * cross; }
  return Math.abs(twiceArea) > 1e-10 ? { longitude: x / (3 * twiceArea), latitude: y / (3 * twiceArea), weight: Math.abs(twiceArea) } : null;
};
export const cityPointsForCodes = async (codes) => {
  const requested = new Set((codes || []).map(String)); const features = await loadCityFeatures(); const points = new Map();
  features.forEach((feature) => { if (!requested.has(feature.code)) return; const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates; const centers = polygons.map((polygon) => polygonCenter(polygon[0])).filter(Boolean).sort((a, b) => b.weight - a.weight); if (centers[0]) points.set(feature.code, { code: feature.code, name: feature.name, longitude: centers[0].longitude, latitude: centers[0].latitude }); });
  const missing = [...requested].filter((code) => !points.has(code)); if (missing.length) throw new Error(`市级地图中未找到城市代码：${missing.join(', ')}。`);
  return points;
};
export const loadCityBoundaries = async (provinceCode) => {
  const code = String(provinceCode || '');
  if (!isCityBoundaryProvince(code)) return [];
  if (!cityBoundaryCache.has(code)) cityBoundaryCache.set(code, loadCityFeatures().then((features) => features.filter((feature) => feature.code.startsWith(code.slice(0, 2)))).catch(() => []));
  return cityBoundaryCache.get(code);
};
const walkCoordinates = (coordinates, callback) => Array.isArray(coordinates?.[0]) ? coordinates.forEach((item) => walkCoordinates(item, callback)) : callback(coordinates);
export const boundsForFeatures = (features) => {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  features.forEach((feature) => walkCoordinates(feature.geometry.coordinates, ([x, y]) => { bounds[0] = Math.min(bounds[0], number(x)); bounds[1] = Math.min(bounds[1], number(y)); bounds[2] = Math.max(bounds[2], number(x)); bounds[3] = Math.max(bounds[3], number(y)); }));
  return bounds;
};
export const createProjection = (features, width, height, padding = 28) => {
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = boundsForFeatures(features);
  // GeoJSON stores longitude/latitude in angular degrees, not equal planar
  // distances. Drawing the two degree axes 1:1 makes east-west distances too
  // large around China and visually squashes the country vertically. Use one
  // local equirectangular reference latitude, then use one *single* SVG scale
  // for both resulting axes. This is a projection, never non-uniform scaling.
  const referenceLatitude = (minLatitude + maxLatitude) / 2;
  const longitudeUnit = Math.cos(referenceLatitude * DEGREES_TO_RADIANS);
  const projectLongitude = (longitude) => longitude * longitudeUnit;
  const minX = projectLongitude(minLongitude), maxX = projectLongitude(maxLongitude);
  const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxLatitude - minLatitude));
  const offsetX = (width - (maxX - minX) * scale) / 2, offsetY = (height - (maxLatitude - minLatitude) * scale) / 2;
  return ([longitude, latitude]) => [offsetX + (projectLongitude(longitude) - minX) * scale, height - (offsetY + (latitude - minLatitude) * scale)];
};
const ringPath = (ring, project) => ring.map((point, index) => `${index ? 'L' : 'M'}${project(point).map((value) => value.toFixed(2)).join(',')}`).join('') + 'Z';
export const featurePath = (feature, project) => (feature.geometry.type === 'Polygon' ? feature.geometry.coordinates : feature.geometry.coordinates.flat()).map((ring) => ringPath(ring, project)).join('');

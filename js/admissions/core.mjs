export const NANJING = Object.freeze({ longitude: 118.796877, latitude: 32.060255 });

export const PROVINCIAL_CAPITALS = Object.freeze({
  '110000': [116.4074, 39.9042], '120000': [117.2000, 39.0842], '130000': [114.5149, 38.0428],
  '140000': [112.5492, 37.8570], '150000': [111.7519, 40.8414], '210000': [123.4315, 41.8057],
  '220000': [125.3235, 43.8171], '230000': [126.5349, 45.8038], '310000': [121.4737, 31.2304],
  '320000': [118.7969, 32.0603], '330000': [120.1551, 30.2741], '340000': [117.2272, 31.8206],
  '350000': [119.2965, 26.0745], '360000': [115.8579, 28.6820], '370000': [117.1201, 36.6512],
  '410000': [113.6254, 34.7466], '420000': [114.3054, 30.5931], '430000': [112.9388, 28.2282],
  '440000': [113.2644, 23.1291], '450000': [108.3200, 22.8240], '460000': [110.3492, 20.0174],
  '500000': [106.5516, 29.5630], '510000': [104.0665, 30.5723], '520000': [106.6302, 26.6470],
  '530000': [102.8329, 24.8801], '540000': [91.1322, 29.6604], '610000': [108.9398, 34.3416],
  '620000': [103.8343, 36.0611], '630000': [101.7782, 36.6171], '640000': [106.2309, 38.4872],
  '650000': [87.6168, 43.8256], '710000': [121.5654, 25.0330], '810000': [114.1694, 22.3193], '820000': [113.5439, 22.1987]
});

const R = 6371.0088;
const radians = (value) => value * Math.PI / 180;
export const haversineKm = (from, to) => {
  const dLat = radians(to.latitude - from.latitude), dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
};

export const safeText = (value, fallback = '') => String(value ?? fallback).replace(/[<>]/g, '').trim();
export const logoInitial = (name) => Array.from(safeText(name, '校'))[0] || '校';

export const normalizeRows = (rows) => {
  if (!Array.isArray(rows)) throw new Error('录取数据格式错误：RPC 未返回数组。');
  const seenPeople = new Set();
  return rows.map((row, index) => {
    const required = ['university_id', 'university_name', 'province_code', 'city_code', 'display_name'];
    const missing = required.filter((key) => !safeText(row?.[key]));
    if (missing.length) throw new Error(`录取数据第 ${index + 1} 条缺少字段：${missing.join(', ')}。`);
    if (!/^\d{6}$/.test(String(row.province_code)) || !/^\d{6}$/.test(String(row.city_code)) || !String(row.city_code).startsWith(String(row.province_code).slice(0, 2))) {
      throw new Error(`录取数据第 ${index + 1} 条的省级或市级行政区代码无效。`);
    }
    // The RPC deliberately does not return person_id. A unique public-facing
    // display row key is sufficient for rendering, while DB constraints catch
    // duplicate final admissions before data reaches the page.
    return { ...row, university_order: Number(row.university_order) || 0, province_display_order: Number(row.province_display_order) || 0 };
  });
};

export const buildProvinceGroups = (rows) => {
  const provinces = new Map();
  rows.forEach((row) => {
    const key = String(row.province_code);
    if (!provinces.has(key)) provinces.set(key, { code: key, name: row.province_name, displayOrder: row.province_display_order || row.university_order || 0, cities: new Map(), universities: new Map(), students: 0 });
    const province = provinces.get(key); province.students += 1;
    province.displayOrder = Math.min(province.displayOrder || Number.MAX_SAFE_INTEGER, row.province_display_order || row.university_order || Number.MAX_SAFE_INTEGER);
    if (!province.cities.has(row.city_name)) province.cities.set(row.city_name, { name: row.city_name, longitude: row.longitude, latitude: row.latitude, universities: new Map() });
    const city = province.cities.get(row.city_name);
    if (!province.universities.has(row.university_id)) province.universities.set(row.university_id, { id: row.university_id, name: row.university_name, shortName: row.short_name, city: row.city_name, campus: row.campus, longitude: row.longitude, latitude: row.latitude, logoPath: row.logo_path, brandPath: row.brand_path, order: row.university_order, students: [] });
    const university = province.universities.get(row.university_id); university.students.push({ name: row.display_name, major: row.major });
    city.universities.set(row.university_id, university);
  });
  provinces.forEach((province) => {
    province.cities = [...province.cities.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    // `displayOrder` is the source-of-truth order supplied with the data;
    // city/name are only deterministic fallbacks.
    province.universities = [...province.universities.values()].sort((a, b) => a.order - b.order || a.city.localeCompare(b.city, 'zh-Hans-CN') || a.name.localeCompare(b.name, 'zh-Hans-CN'));
    province.universities.forEach((university) => university.students.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN')));
  });
  return provinces;
};

export const orderedProvinces = (groups) => [...groups.values()].map((province) => {
  const capital = PROVINCIAL_CAPITALS[province.code];
  if (!capital) throw new Error(`省份 ${province.name}（${province.code}）缺少省会代表点，无法计算播放顺序。`);
  return { ...province, distanceKm: province.code === '320000' ? 0 : haversineKm(NANJING, { longitude: capital[0], latitude: capital[1] }) };
}).sort((a, b) => (a.code === '320000' ? -1 : b.code === '320000' ? 1 : a.distanceKm - b.distanceKm || a.code.localeCompare(b.code)));

export const colorForCount = (count, max) => {
  if (!count) return '#fff';
  const t = Math.max(0, Math.min(1, (count - 1) / Math.max(1, max - 1)));
  const from = [218, 234, 242], to = [34, 91, 125];
  const mixed = from.map((value, index) => Math.round(value + (to[index] - value) * t));
  return `rgb(${mixed.join(' ')})`;
};

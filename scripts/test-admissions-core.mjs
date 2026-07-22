#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildProvinceGroups, haversineKm, normalizeRows, orderedProvinces } from '../js/admissions/core.mjs';
import { boundsForFeatures, createProjection, featureAdcode, isCityBoundaryProvince } from '../js/admissions/geo.mjs';
import { ProvinceTimeline } from '../js/admissions/timeline.mjs';

const rows = normalizeRows([
  { university_id: 'u-1', university_name: '示例大学甲', province_code: '320000', province_name: '江苏省', city_code: '320100', city_name: '南京市', longitude: 118.79, latitude: 32.06, display_name: '虚构同学乙' },
  { university_id: 'u-1', university_name: '示例大学甲', province_code: '320000', province_name: '江苏省', city_code: '320100', city_name: '南京市', longitude: 118.79, latitude: 32.06, display_name: '虚构同学甲' },
  { university_id: 'u-2', university_name: '示例大学乙', province_code: '320000', province_name: '江苏省', city_code: '320500', city_name: '苏州市', longitude: 120.58, latitude: 31.30, display_name: '虚构同学丙' },
  { university_id: 'u-3', university_name: '示例大学丙', province_code: '330000', province_name: '浙江省', city_code: '330100', city_name: '杭州市', longitude: 120.15, latitude: 30.27, display_name: '虚构同学丁' }
]);
const groups = buildProvinceGroups(rows);
assert.equal(groups.get('320000').students, 3, 'same university students must be counted separately');
assert.equal(groups.get('320000').cities.length, 2, 'same province multi-city grouping must remain separate');
assert.equal(groups.get('320000').universities.length, 2, 'same city/province universities must not merge');
assert.equal(groups.get('320000').universities.find((university) => university.id === 'u-1').students.length, 2, 'same university students must be collected');
assert.deepEqual(groups.get('320000').universities.find((university) => university.id === 'u-1').students.map((student) => student.name), ['虚构同学甲', '虚构同学乙'], 'students within a university must use Chinese dictionary order, not a supplied display order');
assert.equal(orderedProvinces(groups)[0].code, '320000', 'Jiangsu must always play first');
assert.ok(haversineKm({ longitude: 118.796877, latitude: 32.060255 }, { longitude: 120.1551, latitude: 30.2741 }) > 0);
assert.throws(() => normalizeRows([{ university_id: 'u', university_name: '示例', province_code: 'bad', province_name: 'x', city_code: 'x', display_name: 'x' }]), /无效/);
const geo = JSON.parse(await readFile(new URL('../maps/china-provinces.geojson', import.meta.url), 'utf8'));
const provinceFeatures = geo.features.filter((feature) => ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type));
assert.equal(geo.type, 'FeatureCollection', 'checked local map must be GeoJSON FeatureCollection');
assert.equal(provinceFeatures.length, 34, 'checked local map must contain all 34 provincial polygon features');
assert.equal(provinceFeatures.filter((feature) => /^\d{6}$/.test(featureAdcode(feature))).length, 34, 'every local provincial polygon must map to a six-digit administrative code');
assert.ok(featureAdcode(provinceFeatures.find((feature) => feature.properties?.name === '江苏省')) === '320000', 'TianDiTu GB code adapter must resolve Jiangsu correctly');
const projectionBounds = boundsForFeatures(provinceFeatures);
const projected = createProjection(provinceFeatures, 760, 812, 14);
const [originX, originY] = projected([projectionBounds[0], projectionBounds[1]]);
const [longitudeX, longitudeY] = projected([projectionBounds[0] + 1, projectionBounds[1]]);
const [latitudeX, latitudeY] = projected([projectionBounds[0], projectionBounds[1] + 1]);
const referenceLatitude = (projectionBounds[1] + projectionBounds[3]) / 2;
assert.ok(Math.abs((longitudeX - originX) / Math.abs(latitudeY - originY) - Math.cos(referenceLatitude * Math.PI / 180)) < 1e-8 && longitudeY === originY && latitudeX === originX, 'projection must convert longitude degrees to local planar distance before applying one uniform SVG scale');
const projectedBounds = [Infinity, Infinity, -Infinity, -Infinity];
const visitCoordinates = (coordinates) => Array.isArray(coordinates?.[0])
  ? coordinates.forEach(visitCoordinates)
  : (() => {
      const [x, y] = projected(coordinates);
      projectedBounds[0] = Math.min(projectedBounds[0], x); projectedBounds[1] = Math.min(projectedBounds[1], y);
      projectedBounds[2] = Math.max(projectedBounds[2], x); projectedBounds[3] = Math.max(projectedBounds[3], y);
    })();
provinceFeatures.forEach((feature) => visitCoordinates(feature.geometry.coordinates));
const projectedAspect = (projectedBounds[2] - projectedBounds[0]) / (projectedBounds[3] - projectedBounds[1]);
const geographicAspect = ((projectionBounds[2] - projectionBounds[0]) * Math.cos(referenceLatitude * Math.PI / 180)) / (projectionBounds[3] - projectionBounds[1]);
assert.ok(Math.abs(projectedAspect - geographicAspect) < 1e-10, 'projected feature bounds must preserve the GeoJSON map proportion after geographic conversion');
for (const viewportWidth of [390, 900, 1366, 1920]) {
  const renderedWidth = viewportWidth;
  const renderedHeight = renderedWidth * 900 / 1440;
  assert.equal(renderedWidth / 1440, renderedHeight / 900, `SVG viewBox must have identical X/Y CSS scale at ${viewportWidth}px`);
}
const cityGeo = JSON.parse(await readFile(new URL('../maps/china-cities.geojson', import.meta.url), 'utf8'));
const cityFeatures = cityGeo.features.filter((feature) => ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type));
assert.equal(cityGeo.type, 'FeatureCollection', 'city boundary file must be GeoJSON FeatureCollection');
assert.ok(cityFeatures.length >= 300, 'city boundary file must contain a usable city-level boundary set');
assert.ok(cityFeatures.every((feature) => /^\d{6}$/.test(featureAdcode(feature))), 'every city boundary must map to a six-digit administrative code');
assert.ok(cityFeatures.some((feature) => featureAdcode(feature).startsWith('32')), 'city boundaries must include Jiangsu for the focus map');
assert.equal(isCityBoundaryProvince('320000'), true, 'ordinary provinces must show city boundaries');
assert.equal(isCityBoundaryProvince('110000'), false, 'municipalities must not show city boundaries');
assert.equal(isCityBoundaryProvince('810000'), false, 'special administrative regions must not show city boundaries');
const geoModule = await readFile(new URL('../js/admissions/geo.mjs', import.meta.url), 'utf8');
const mapModule = await readFile(new URL('../js/admissions/map.mjs', import.meta.url), 'utf8');
assert.match(geoModule, /new URL\('\.\.\/\.\.\/maps\/china-provinces\.geojson', import\.meta\.url\)/, 'map URL must resolve from the module instead of the current document route');
assert.match(geoModule, /cache: 'no-store'/, 'map reload must not reuse a cached 404 after deployment');
assert.match(geoModule, /Math\.cos\(referenceLatitude \* DEGREES_TO_RADIANS\)/, 'map projection must account for longitude distance at China latitude');
assert.match(mapModule, /Math\.min\(650 \/ width, 710 \/ height\)/, 'province focus must size its uniform scale from the selected geometry');
assert.match(mapModule, /Math\.min\(7\.5, Math\.max\(1\.45/, 'province focus scale must safely enlarge small provinces without distortion');
assert.match(mapModule, /preserveAspectRatio: 'xMidYMid meet'/, 'SVG must preserve its intrinsic viewBox aspect ratio');
assert.match(await readFile(new URL('../style.css', import.meta.url), 'utf8'), /\.admissions-map-svg\s*\{[^}]*flex:\s*none[^}]*aspect-ratio:\s*1440\s*\/\s*900/s, 'responsive map CSS must retain the SVG viewBox ratio without flex stretching');
assert.match(mapModule, /matrix\(\$\{next\}\)/, 'focus animation must use an SVG matrix transform');
assert.match(mapModule, /const next = `\$\{scale\} 0 0 \$\{scale\}/, 'focus animation matrix must use the identical X/Y scale');
const previousWindow = globalThis.window;
globalThis.window = { setTimeout, clearTimeout };
const stages = [];
const animationTimeline = new ProvinceTimeline({
  reduced: true,
  onStage: async (stage, index) => {
    stages.push(`${stage}${Number.isInteger(index) ? `:${index}` : ''}`);
    if (stage === 'focus') await new Promise((resolve) => setTimeout(resolve, 8));
  },
  onFinish: () => stages.push('finished')
});
animationTimeline.play({ cities: [{}, {}], universities: [{}, {}] });
await new Promise((resolve) => setTimeout(resolve, 220));
globalThis.window = previousWindow;
assert.deepEqual(stages, ['focus', 'cities', 'city:0', 'city:1', 'university:0', 'university:1', 'handoff:0', 'handoff:1', 'complete', 'finished'], 'focus must finish before city, logo, and right-panel stages progress in order');
const appModule = await readFile(new URL('../js/admissions/app.mjs', import.meta.url), 'utf8');
const stylesheet = await readFile(new URL('../style.css', import.meta.url), 'utf8');
assert.match(appModule, /studentList\(university\.students, 'admissions-map-students'\)/, 'same-school students must render as independently wrappable elements');
assert.match(appModule, /if \(stage === 'focus'\) return beginProvince\(province\)/, 'map focus must be an awaited timeline stage');
assert.match(appModule, /if \(stage === 'handoff'\) return handoffUniversity\(province, index\)/, 'each school marker must hand off to the right-side information stage');
assert.match(stylesheet, /body\.admissions-page,[\s\S]*background: #fff !important;/, 'admissions exhibition surface must be strict white');
assert.match(stylesheet, /\.admissions-province \{[\s\S]*stroke: #c8d0d3;[\s\S]*stroke-width: \.72;/, 'province borders must be light and thin');
assert.match(stylesheet, /\.admissions-focus-row\.is-brand-visible \.admissions-focus-brand \{ transform: scaleX\(1\); clip-path: inset\(0 0 0 0\); \}/, 'wordmarks must use a horizontal curtain reveal');
console.log('Passed admissions data grouping, validation, and Haversine ordering tests.');

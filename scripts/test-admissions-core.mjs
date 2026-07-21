#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildProvinceGroups, haversineKm, normalizeRows, orderedProvinces } from '../js/admissions/core.mjs';

const rows = normalizeRows([
  { university_id: 'u-1', university_name: '示例大学甲', province_code: '320000', province_name: '江苏省', city_name: '南京市', longitude: 118.79, latitude: 32.06, display_name: '虚构同学甲' },
  { university_id: 'u-1', university_name: '示例大学甲', province_code: '320000', province_name: '江苏省', city_name: '南京市', longitude: 118.79, latitude: 32.06, display_name: '虚构同学乙' },
  { university_id: 'u-2', university_name: '示例大学乙', province_code: '320000', province_name: '江苏省', city_name: '苏州市', longitude: 120.58, latitude: 31.30, display_name: '虚构同学丙' },
  { university_id: 'u-3', university_name: '示例大学丙', province_code: '330000', province_name: '浙江省', city_name: '杭州市', longitude: 120.15, latitude: 30.27, display_name: '虚构同学丁' }
]);
const groups = buildProvinceGroups(rows);
assert.equal(groups.get('320000').students, 3, 'same university students must be counted separately');
assert.equal(groups.get('320000').cities.length, 2, 'same province multi-city grouping must remain separate');
assert.equal(groups.get('320000').universities.length, 2, 'same city/province universities must not merge');
assert.equal(groups.get('320000').universities.find((university) => university.id === 'u-1').students.length, 2, 'same university students must be collected');
assert.equal(orderedProvinces(groups)[0].code, '320000', 'Jiangsu must always play first');
assert.ok(haversineKm({ longitude: 118.796877, latitude: 32.060255 }, { longitude: 120.1551, latitude: 30.2741 }) > 0);
assert.throws(() => normalizeRows([{ university_id: 'u', university_name: '示例', province_code: 'bad', province_name: 'x', city_name: 'x', longitude: 0, latitude: 0, display_name: 'x' }]), /无效/);
console.log('Passed admissions data grouping, validation, and Haversine ordering tests.');

import { normalizeRows, buildProvinceGroups, orderedProvinces } from './core.mjs';
import { cityPointsForCodes, provinceNamesForCodes } from './geo.mjs';

let loaded = null;
export const loadAdmissions = async ({ force = false } = {}) => {
  if (loaded && !force) return loaded;
  loaded = (async () => {
    await window.waitForAccess?.();
    const client = await window.ClassRecordSupabase?.getClient?.();
    if (!client) throw new Error('录取数据暂不可用：安全数据客户端未初始化。');
    const { data, error } = await client.rpc('get_class_admission_map');
    if (error) throw new Error('录取数据加载失败，请检查访问权限或稍后重试。');
    const normalized = normalizeRows(data);
    const [cityPoints, provinceNames] = await Promise.all([cityPointsForCodes(normalized.map((row) => row.city_code)), provinceNamesForCodes(normalized.map((row) => row.province_code))]);
    const rows = normalized.map((row) => ({ ...row, ...cityPoints.get(row.city_code), city_name: cityPoints.get(row.city_code).name, province_name: provinceNames.get(row.province_code) }));
    const groups = buildProvinceGroups(rows);
    return { rows, groups, ordered: orderedProvinces(groups) };
  })().catch((error) => { loaded = null; throw error; });
  return loaded;
};
export const clearAdmissions = () => { loaded = null; };
window.addEventListener('classrecordcacheclearing', clearAdmissions);
window.addEventListener('pagehide', clearAdmissions);

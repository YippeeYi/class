import { colorForCount, logoInitial, PROVINCIAL_CAPITALS } from './core.mjs';
import { createProjection, featurePath } from './geo.mjs';
import { loadLogoUrl } from './assets.mjs';

const esc = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const svgText = (x, y, value, size = 30, weight = 400, anchor = 'start') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Noto Sans CJK SC, Microsoft YaHei, sans-serif" font-size="${size}" font-weight="${weight}" fill="#14222d">${esc(value)}</text>`;
const dataUrlForBrand = async (university) => {
  const url = await loadLogoUrl(university.brandPath || university.logoPath); if (!url) return '';
  try { const blob = await fetch(url, { credentials: 'omit' }).then((response) => response.ok ? response.blob() : Promise.reject()); return await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => resolve(''); reader.readAsDataURL(blob); }); } catch { return ''; }
};
const provinceHeight = (province) => 66 + province.universities.length * 94;
const distribute = (items, side, height) => {
  const gap = 42, total = items.reduce((sum, item) => sum + provinceHeight(item), 0) + Math.max(0, items.length - 1) * gap; let y = Math.max(620, (height - total) / 2);
  return items.map((province) => { const output = { province, side, y, height: provinceHeight(province) }; y += output.height + gap; return output; });
};

export const buildPosterSvg = async ({ features, groups, ordered, title = '班级同学蹭饭图' }) => {
  const width = 7680, initialMap = { x: 1580, y: 460, width: 4520, height: 3860 };
  const initialBaseProject = createProjection(features, initialMap.width, initialMap.height, 72);
  const initialProject = (point) => { const [x, y] = initialBaseProject(point); return [x + initialMap.x, y + initialMap.y]; };
  const provinces = [...ordered].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'zh-Hans-CN'));
  const sides = { left: [], right: [] };
  provinces.forEach((province) => { const capital = PROVINCIAL_CAPITALS[province.code]; if (!capital) return; const [x, y] = initialProject(capital); sides[x < width / 2 ? 'left' : 'right'].push({ ...province, anchor: { x, y } }); });
  const height = Math.max(4320, ...Object.values(sides).map((items) => items.reduce((sum, item) => sum + provinceHeight(item), 0) + Math.max(0, items.length - 1) * 42 + 900));
  const map = { x: 1580, y: 460, width: 4520, height: height - 640 };
  const projectBase = createProjection(features, map.width, map.height, 72);
  const project = (point) => { const [x, y] = projectBase(point); return [x + map.x, y + map.y]; };
  sides.left = []; sides.right = [];
  provinces.forEach((province) => { const capital = PROVINCIAL_CAPITALS[province.code]; if (!capital) return; const [x, y] = project(capital); sides[x < width / 2 ? 'left' : 'right'].push({ ...province, anchor: { x, y } }); });
  const annotations = [...distribute(sides.left, 'left', height), ...distribute(sides.right, 'right', height)];
  const max = Math.max(1, ...[...groups.values()].map((item) => item.students));
  const paths = features.map((feature) => `<path d="${featurePath(feature, project)}" fill="${colorForCount(groups.get(feature.code)?.students || 0, max)}" stroke="#101820" stroke-width="7"/>`).join('');
  const brands = new Map(await Promise.all(provinces.flatMap((province) => province.universities).map(async (university) => [university.id, await dataUrlForBrand(university)])));
  const labels = annotations.map(({ province, side, y }) => {
    const x = side === 'left' ? 150 : 6220, width = 1280, endpointX = side === 'left' ? x + width : x, elbowX = side === 'left' ? map.x - 110 : map.x + map.width + 110;
    const leader = `<polyline points="${province.anchor.x},${province.anchor.y} ${elbowX},${province.anchor.y} ${elbowX},${y + 28} ${endpointX},${y + 28}" fill="none" stroke="#65808e" stroke-width="4" stroke-dasharray="5 12" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${province.anchor.x}" cy="${province.anchor.y}" r="12" fill="#21495f" stroke="#fff" stroke-width="5"/>`;
    let cursor = y + 78; const rows = province.universities.map((university) => { const image = brands.get(university.id), students = university.students.map((student) => student.name).join('、'); const item = `${image ? `<image href="${esc(image)}" x="${x}" y="${cursor - 42}" width="650" height="54" preserveAspectRatio="xMinYMid meet"/>` : svgText(x, cursor, logoInitial(university.name), 36, 800)}${svgText(x + 690, cursor, students, 34, 500)}`; cursor += 94; return item; }).join('');
    return `<g>${leader}${svgText(x, y + 28, province.name, 34, 800)}${rows}</g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#eef4f6"/>${svgText(170, 220, title, 104, 750)}${svgText(176, 294, '最终录取去向 · 以省会为信息起点', 34, 400)}${paths}${labels}${svgText(width / 2, height - 110, '颜色深浅表示各省录取人数', 28, 500, 'middle')}</svg>`;
  return { svg, width, height };
};
export const downloadPoster = async (options) => {
  await document.fonts?.ready; const { svg, width, height } = await buildPosterSvg(options); const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器不支持总图画布。');
  try { const image = await createImageBitmap(blob); context.drawImage(image, 0, 0); image.close(); }
  catch {
    const objectUrl = URL.createObjectURL(blob);
    try { const image = await new Promise((resolve, reject) => { const node = new Image(); node.onload = () => resolve(node); node.onerror = reject; node.src = objectUrl; }); context.drawImage(image, 0, 0); }
    finally { URL.revokeObjectURL(objectUrl); }
  }
  const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png')); if (!png) throw new Error('总图生成失败。');
  const url = URL.createObjectURL(png), link = document.createElement('a'); link.href = url; link.download = '班级同学蹭饭图.png'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

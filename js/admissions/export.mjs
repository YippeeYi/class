import { colorForCount, logoInitial } from './core.mjs';
import { createProjection, featurePath } from './geo.mjs';
import { loadLogoUrl } from './assets.mjs';

const esc = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const svgText = (x, y, value, size = 30, weight = 400) => `<text x="${x}" y="${y}" font-family="Noto Sans CJK SC, Microsoft YaHei, sans-serif" font-size="${size}" font-weight="${weight}" fill="#14222d">${esc(value)}</text>`;

const dataUrlForLogo = async (university) => {
  const url = await loadLogoUrl(university.logoPath); if (!url) return '';
  try { const blob = await fetch(url, { credentials: 'omit' }).then((response) => response.ok ? response.blob() : Promise.reject()); return await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => resolve(''); reader.readAsDataURL(blob); }); } catch { return ''; }
};

export const buildPosterSvg = async ({ features, groups, ordered, title = '班级同学蹭饭图' }) => {
  const cardsData = ordered.flatMap((province) => province.universities.map((university) => ({ province, university })));
  const height = Math.max(4320, 820 + Math.ceil(cardsData.length / 2) * 260 + 260), width = 7680, mapX = 1420, mapY = 720, mapW = 4860, mapH = 3500, projectBase = createProjection(features, mapW, mapH, 80);
  const project = (point) => { const [x, y] = projectBase(point); return [x + mapX, y + mapY]; };
  const max = Math.max(1, ...[...groups.values()].map((item) => item.students));
  const paths = features.map((feature) => `<path d="${featurePath(feature, project)}" fill="${colorForCount(groups.get(feature.code)?.students || 0, max)}" stroke="#111820" stroke-width="7"/>`).join('');
  const embeddedLogos = new Map(await Promise.all(cardsData.map(async ({ university }) => [university.id, await dataUrlForLogo(university)])));
  const cards = cardsData.map(({ province, university }, index) => {
    const column = index % 2, row = Math.floor(index / 2), x = column ? 6360 : 150, y = 760 + row * 330;
    const students = university.students.map((student) => student.major ? `${student.name} · ${student.major}` : student.name).join('、'); const logo = embeddedLogos.get(university.id);
    return `<g><path d="M${column ? 6230 : 1450},${mapY + 300 + row * 150} L${column ? x - 35 : x + 1160},${y + 25}" stroke="#59758b" stroke-width="3" fill="none"/><rect x="${x}" y="${y}" width="1170" height="270" rx="28" fill="#ffffff" stroke="#274a64" stroke-width="3"/>${logo ? `<image href="${esc(logo)}" x="${x + 27}" y="${y + 27}" width="72" height="72" preserveAspectRatio="xMidYMid meet"/>` : `<circle cx="${x + 63}" cy="${y + 63}" r="35" fill="#d7e8f3"/>${svgText(x + 50, y + 73, logoInitial(university.name), 29, 700)}`}${svgText(x + 120, y + 57, province.name, 24, 600)}${svgText(x + 120, y + 101, university.name, 34, 700)}${svgText(x + 55, y + 158, university.city, 23)}${svgText(x + 55, y + 205, students.slice(0, 62), 22)}${svgText(x + 55, y + 243, students.slice(62, 124), 22)}</g>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#eef5f8"/>${svgText(180, 250, title, 104, 700)}${svgText(185, 330, '最终录取去向 · 仅限已获访问授权的班级成员使用', 38)}${paths}${cards}<g transform="translate(3200 ${height - 150})">${svgText(0, 0, '录取人数', 30, 700)}${[0, .25, .5, .75, 1].map((t, index) => `<rect x="${150 + index * 150}" y="-32" width="150" height="40" fill="${colorForCount(Math.max(1, Math.round(1 + (max - 1) * t)), max)}"/><text x="${150 + index * 150}" y="48" font-size="24" text-anchor="middle">${index === 0 ? 1 : Math.round(1 + (max - 1) * t)}</text>`).join('')}</g></svg>`;
  return { svg, width, height };
};
export const downloadPoster = async (options) => {
  await document.fonts?.ready; const { svg, width, height } = await buildPosterSvg(options); const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const image = await createImageBitmap(blob); const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; canvas.getContext('2d').drawImage(image, 0, 0); image.close();
  const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png')); if (!png) throw new Error('总图生成失败。');
  const url = URL.createObjectURL(png), link = document.createElement('a'); link.href = url; link.download = '班级同学蹭饭图.png'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

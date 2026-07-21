import { createProjection, featurePath } from './geo.mjs';
import { colorForCount } from './core.mjs';

const NS = 'http://www.w3.org/2000/svg';
const element = (name, attributes = {}) => { const node = document.createElementNS(NS, name); Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value)); return node; };

export const renderNationalMap = (host, features, groups, { onSelect, onFocus } = {}) => {
  host.replaceChildren();
  const viewBox = { width: 920, height: 650 }, project = createProjection(features, viewBox.width, viewBox.height);
  const svg = element('svg', { class: 'admissions-map-svg', viewBox: `0 0 ${viewBox.width} ${viewBox.height}`, role: 'img', 'aria-label': '中国省级行政区录取分布图', preserveAspectRatio: 'xMidYMid meet' });
  const max = Math.max(1, ...[...groups.values()].map((item) => item.students));
  features.forEach((feature) => {
    const province = groups.get(feature.code), active = Boolean(province);
    const path = element('path', { d: featurePath(feature, project), class: `admissions-province${active ? ' has-admissions' : ''}`, fill: colorForCount(province?.students || 0, max), tabindex: active ? '0' : '-1', 'data-code': feature.code, 'aria-label': `${feature.name}，${province ? `${province.students} 名同学，${province.universities.length} 所大学，${province.cities.length} 个城市` : '暂无录取信息'}` });
    const activate = () => active && onSelect?.(province, feature, { project, features });
    path.addEventListener('click', activate); path.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
    path.addEventListener('focus', () => onFocus?.(province, feature)); path.addEventListener('mouseenter', () => onFocus?.(province, feature));
    svg.append(path);
  });
  host.append(svg); return { svg, project, max };
};

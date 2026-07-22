import { boundsForFeatures, createProjection, featurePath } from './geo.mjs';
import { colorForCount, PROVINCIAL_CAPITALS } from './core.mjs';

const NS = 'http://www.w3.org/2000/svg';
const element = (name, attributes = {}) => { const node = document.createElementNS(NS, name); Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value)); return node; };

const annotationHeight = (province) => 38 + province.universities.length * 44;
const sortForDisplay = (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name, 'zh-Hans-CN');
const distribute = (items, side, canvas) => {
  const gap = 22, height = items.reduce((sum, item) => sum + annotationHeight(item), 0) + Math.max(0, items.length - 1) * gap;
  let cursor = Math.max(40, (canvas.height - height) / 2);
  return items.map((province) => {
    const blockHeight = annotationHeight(province), y = cursor + blockHeight / 2;
    cursor += blockHeight + gap;
    return { province, side, x: side === 'left' ? 28 : canvas.width - 330, y, height: blockHeight, width: 302 };
  });
};

const buildAnnotationLayout = (groups, project, canvas) => {
  const provinces = [...groups.values()].sort(sortForDisplay);
  const sides = { left: [], right: [] };
  provinces.forEach((province) => {
    const capital = PROVINCIAL_CAPITALS[province.code];
    if (!capital) return;
    const [x, y] = project(capital);
    sides[x < canvas.width / 2 ? 'left' : 'right'].push({ ...province, anchor: { x, y } });
  });
  return [...distribute(sides.left, 'left', canvas), ...distribute(sides.right, 'right', canvas)];
};

export const renderNationalMap = (host, features, groups, { onSelect, onFocus, renderProvinceInfo } = {}) => {
  host.replaceChildren();
  const canvas = { width: 1440, height: 900, map: { x: 340, y: 44, width: 760, height: 812 } };
  const baseProject = createProjection(features, canvas.map.width, canvas.map.height, 14);
  const project = (point) => { const [x, y] = baseProject(point); return [x + canvas.map.x, y + canvas.map.y]; };
  const svg = element('svg', { class: 'admissions-map-svg', width: canvas.width, height: canvas.height, viewBox: `0 0 ${canvas.width} ${canvas.height}`, role: 'img', 'aria-label': '中国省级行政区录取分布图', preserveAspectRatio: 'xMidYMid meet' });
  const max = Math.max(1, ...[...groups.values()].map((item) => item.students));
  const shapeLayer = element('g', { class: 'admissions-map-shape-layer' });
  features.forEach((feature) => {
    const province = groups.get(feature.code), active = Boolean(province);
    const path = element('path', { d: featurePath(feature, project), class: `admissions-province${active ? ' has-admissions' : ''}`, fill: colorForCount(province?.students || 0, max), tabindex: active ? '0' : '-1', 'data-code': feature.code, 'aria-label': `${feature.name}，${province ? `${province.students} 名同学，${province.universities.length} 所大学，${province.cities.length} 个城市` : '暂无录取信息'}` });
    const activate = () => active && onSelect?.(province, feature, { project, features });
    path.addEventListener('click', activate); path.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
    path.addEventListener('focus', () => onFocus?.(province, feature)); path.addEventListener('mouseenter', () => onFocus?.(province, feature));
    shapeLayer.append(path);
  });
  svg.append(shapeLayer);
  const layout = buildAnnotationLayout(groups, project, canvas);
  const lines = element('g', { class: 'admissions-leader-lines', 'aria-hidden': 'true' });
  layout.forEach((item) => {
    const endX = item.side === 'left' ? item.x + item.width : item.x;
    const elbowX = item.side === 'left' ? canvas.map.x - 38 : canvas.map.x + canvas.map.width + 38;
    const polyline = element('polyline', { points: `${item.province.anchor.x},${item.province.anchor.y} ${elbowX},${item.province.anchor.y} ${elbowX},${item.y} ${endX},${item.y}` });
    const dot = element('circle', { cx: item.province.anchor.x, cy: item.province.anchor.y, r: 5 });
    lines.append(polyline, dot);
  });
  svg.append(lines); host.append(svg);
  const labels = document.createElement('div'); labels.className = 'admissions-map-annotations';
  layout.forEach((item) => {
    const node = document.createElement('section'); node.className = `admissions-province-annotation is-${item.side}`;
    node.style.left = `${item.x / canvas.width * 100}%`; node.style.top = `${(item.y - item.height / 2) / canvas.height * 100}%`; node.style.width = `${item.width / canvas.width * 100}%`;
    node.dataset.provinceCode = item.province.code;
    const output = renderProvinceInfo?.(item.province);
    if (output instanceof Node) node.append(output);
    else if (output?.then) output.then((content) => content && node.append(content));
    labels.append(node);
  });
  host.append(labels);
  const setUniformTransform = (scale, dx, dy, { animate = true } = {}) => {
    const next = `${scale} 0 0 ${scale} ${dx} ${dy}`;
    const previous = shapeLayer.dataset.matrix || '1 0 0 1 0 0';
    shapeLayer.setAttribute('transform', `matrix(${next})`);
    shapeLayer.dataset.matrix = next;
    if (!animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    shapeLayer.querySelectorAll(':scope > animateTransform[data-map-transform]').forEach((node) => node.remove());
    const motion = element('animateTransform', { attributeName: 'transform', type: 'matrix', from: previous, to: next, dur: '850ms', fill: 'freeze', calcMode: 'spline', keySplines: '.16 .84 .2 1', 'data-map-transform': '' });
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(); } };
      motion.addEventListener('endEvent', finish, { once: true });
      shapeLayer.append(motion); motion.beginElement?.();
      window.setTimeout(finish, 880);
    });
  };
  const focus = (province, { animate = true } = {}) => {
    const capital = PROVINCIAL_CAPITALS[province.code];
    if (!capital) return;
    const feature = features.find((item) => item.code === province.code);
    if (!feature) return;
    const [minLongitude, minLatitude, maxLongitude, maxLatitude] = boundsForFeatures([feature]);
    const [left, bottom] = project([minLongitude, minLatitude]);
    const [right, top] = project([maxLongitude, maxLatitude]);
    const width = Math.max(1, Math.abs(right - left)), height = Math.max(1, Math.abs(bottom - top));
    // Fit the selected province into the left exhibition zone with one uniform scale.
    // This preserves every GeoJSON proportion while letting smaller provinces enlarge further.
    const scale = Math.min(7.5, Math.max(1.45, Math.min(650 / width, 710 / height)));
    const sourceCenterX = (left + right) / 2, sourceCenterY = (top + bottom) / 2;
    const targetX = 400, targetY = 452;
    const dx = targetX - sourceCenterX * scale, dy = targetY - sourceCenterY * scale;
    // Transform, selection contrast, and peripheral de-emphasis are applied
    // in the same frame; their CSS/SVG motion shares the 850ms duration.
    const finished = setUniformTransform(scale, dx, dy, { animate });
    shapeLayer.classList.add('is-focused');
    shapeLayer.querySelectorAll('.admissions-province').forEach((path) => path.classList.toggle('is-selected', path.dataset.code === province.code));
    lines.classList.add('is-hidden'); labels.classList.add('is-hidden');
    return { scale, dx, dy, finished };
  };
  const resetFocus = () => {
    setUniformTransform(1, 0, 0); shapeLayer.classList.remove('is-focused');
    shapeLayer.querySelectorAll('.admissions-province').forEach((path) => path.classList.remove('is-selected'));
    lines.classList.remove('is-hidden'); labels.classList.remove('is-hidden');
    svg.querySelectorAll('.admissions-focus-layer').forEach((node) => node.remove());
  };
  return { svg, project, max, layout, canvas, shapeLayer, focus, resetFocus, focusTransform: null };
};

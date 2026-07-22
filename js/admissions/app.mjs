import { loadAdmissions } from './data.mjs';
import { featurePath, isCityBoundaryProvince, loadCityBoundaries, loadGeo } from './geo.mjs';
import { renderNationalMap } from './map.mjs';
import { brandNode, loadLogoUrl, logoNode } from './assets.mjs';
import { downloadPoster } from './export.mjs';
import { ProvinceTimeline } from './timeline.mjs';

const root = document.getElementById('admissions-app');
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const videoRender = new URLSearchParams(location.search).get('render') === 'video';
const NS = 'http://www.w3.org/2000/svg';
const svg = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
};
const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
const cssId = (value) => CSS.escape(String(value));
let model, features, mapState, selected = null, currentIndex = 0, autoplay = false, autoplayPaused = false, timeline;

const setStatus = (value, type = '') => {
  const node = root.querySelector('[data-admissions-status]');
  if (node) { node.textContent = value; node.className = `admissions-status ${type}`; }
};
const provinceAt = (offset) => model.ordered[(currentIndex + offset + model.ordered.length) % model.ordered.length];
const updateControls = () => {
  root.querySelector('[data-progress]')?.replaceChildren(document.createTextNode(selected ? `${currentIndex + 1} / ${model.ordered.length} · ${selected.name}` : ''));
  root.querySelector('[data-pause]')?.toggleAttribute('hidden', !autoplay);
  root.querySelector('[data-resume]')?.toggleAttribute('hidden', !autoplay || !autoplayPaused);
};

const studentList = (students, className) => {
  const list = document.createElement('span');
  list.className = className;
  students.forEach((student) => {
    const name = document.createElement('span');
    name.className = `${className}-item`;
    name.textContent = student.name;
    list.append(name);
  });
  return list;
};

const renderProvinceAnnotation = async (province) => {
  const fragment = document.createDocumentFragment();
  const heading = document.createElement('p');
  heading.className = 'admissions-province-caption';
  heading.textContent = province.name;
  fragment.append(heading);
  for (const university of province.universities) {
    const row = document.createElement('div');
    row.className = 'admissions-map-university-row';
    row.append(await brandNode(university), studentList(university.students, 'admissions-map-students'));
    fragment.append(row);
  }
  return fragment;
};

const clearFocusInfo = () => root.querySelector('[data-focus-info]')?.replaceChildren();
const focusLayer = () => {
  let layer = mapState.svg.querySelector('.admissions-focus-layer');
  if (!layer) {
    layer = svg('g', { class: 'admissions-focus-layer' });
    mapState.shapeLayer.append(layer);
  }
  return layer;
};

const animateTranslate = (node, from, to, duration = 440) => {
  node.setAttribute('transform', `translate(${from.x} ${from.y})`);
  if (videoRender || reduced) { node.setAttribute('transform', `translate(${to.x} ${to.y})`); return Promise.resolve(); }
  const motion = svg('animateTransform', {
    attributeName: 'transform', type: 'translate', from: `${from.x} ${from.y}`, to: `${to.x} ${to.y}`,
    dur: `${duration}ms`, fill: 'freeze', calcMode: 'spline', keySplines: '.16 .84 .2 1'
  });
  node.append(motion); motion.beginElement?.();
  return wait(duration);
};

const prepareCities = async (province) => {
  const layer = focusLayer();
  layer.querySelectorAll('.admissions-city-marker, .admissions-city-boundary-layer').forEach((node) => node.remove());
  if (isCityBoundaryProvince(province.code)) {
    const boundaries = await loadCityBoundaries(province.code);
    if (boundaries.length) {
      const outlines = svg('g', { class: 'admissions-city-boundary-layer', 'aria-hidden': 'true' });
      boundaries.forEach((feature) => outlines.append(svg('path', { d: featurePath(feature, mapState.project) })));
      layer.append(outlines);
      requestAnimationFrame(() => outlines.classList.add('is-visible'));
    }
  }
  province.cities.forEach((city, index) => {
    const [x, y] = mapState.project([city.longitude, city.latitude]);
    const marker = svg('g', { class: 'admissions-city-marker', 'data-city-index': index, transform: `translate(${x} ${y + 20})` });
    marker.append(svg('circle', { r: 4.5 }), svg('text', { x: 10, y: -9 }));
    marker.lastChild.textContent = city.name;
    layer.append(marker);
  });
};

const revealCity = async (province, index) => {
  const city = province.cities[index];
  const marker = focusLayer().querySelector(`[data-city-index="${index}"]`);
  if (!city || !marker) return;
  const [x, y] = mapState.project([city.longitude, city.latitude]);
  marker.classList.add('is-visible');
  await animateTranslate(marker, { x, y: y + 20 }, { x, y }, 420);
};

const renderUniversityMarker = async (province, index) => {
  const university = province.universities[index];
  if (!university) return;
  const layer = focusLayer();
  const [x, y] = mapState.project([university.longitude, university.latitude]);
  let marker = layer.querySelector(`[data-university-id="${cssId(university.id)}"]`);
  if (marker) return marker;
  marker = svg('g', { class: 'admissions-university-marker', 'data-university-id': university.id, transform: `translate(${x} ${y + 20})` });
  marker.append(svg('circle', { r: 25 }));
  const image = svg('image', { x: -20, y: -20, width: 40, height: 40, preserveAspectRatio: 'xMidYMid meet' });
  marker.append(image); layer.append(marker);
  const url = await loadLogoUrl(university.logoPath);
  if (url) image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url);
  marker.classList.add('is-visible');
  await animateTranslate(marker, { x, y: y + 20 }, { x, y }, 440);
  return marker;
};

const infoTarget = (index) => ({ x: 1050, y: 168 + index * 132 });
const mapCoordinateForScreenTarget = (target) => {
  const transform = mapState.focusTransform || { scale: 1, dx: 0, dy: 0 };
  return { x: (target.x - transform.dx) / transform.scale, y: (target.y - transform.dy) / transform.scale };
};

const appendUniversityInfo = async (university, index) => {
  const host = root.querySelector('[data-focus-info]');
  if (!host || host.querySelector(`[data-info-university="${cssId(university.id)}"]`)) return;
  const row = document.createElement('section');
  row.className = 'admissions-focus-row';
  row.dataset.infoUniversity = university.id;
  const logo = await logoNode(university, 'admissions-focus-logo');
  const wordmark = await brandNode(university, 'admissions-focus-brand');
  const students = studentList(university.students, 'admissions-focus-students');
  row.append(logo, wordmark, students);
  host.append(row);
  requestAnimationFrame(() => row.classList.add('is-logo-visible'));
  if (!reduced && !videoRender) await wait(150);
  row.classList.add('is-brand-visible');
  const names = [...students.children];
  for (const name of names) {
    if (!reduced && !videoRender) await wait(105);
    name.classList.add('is-visible');
  }
};

const handoffUniversity = async (province, index) => {
  const university = province.universities[index];
  const marker = focusLayer().querySelector(`[data-university-id="${cssId(university?.id)}"]`);
  if (!university || !marker) return;
  // On a stacked mobile layout the information rail sits below the map, so a
  // long cross-canvas flight would leave the visible stage. Preserve the
  // sequence there while replacing that flight with a clean handoff fade.
  if (window.innerWidth <= 900) {
    marker.classList.add('is-handoff-complete');
    await appendUniversityInfo(university, index);
    return;
  }
  const [x, y] = mapState.project([university.longitude, university.latitude]);
  const target = mapCoordinateForScreenTarget(infoTarget(index));
  marker.classList.add('is-handing-off');
  await animateTranslate(marker, { x, y }, target, 720);
  marker.classList.add('is-handoff-complete');
  await appendUniversityInfo(university, index);
};

const beginProvince = (province) => {
  mapState.resetFocus();
  clearFocusInfo();
  root.classList.add('is-detail');
  const transform = mapState.focus(province, { animate: !videoRender && !reduced });
  mapState.focusTransform = transform;
  return transform.finished;
};

const showDetail = (province, { auto = false } = {}) => {
  selected = province;
  currentIndex = model.ordered.findIndex((item) => item.code === province.code);
  timeline?.stop();
  clearFocusInfo();
  root.classList.add('is-detail');
  timeline = new ProvinceTimeline({
    reduced,
    onStage: async (stage, index) => {
      root.dataset.stage = stage;
      if (stage === 'focus') return beginProvince(province);
      if (stage === 'cities') return prepareCities(province);
      if (stage === 'city') return revealCity(province, index);
      if (stage === 'university') return renderUniversityMarker(province, index);
      if (stage === 'handoff') return handoffUniversity(province, index);
    },
    onFinish: () => {
      root.dataset.stage = 'complete';
      if (autoplay && !autoplayPaused) window.setTimeout(() => showDetail(provinceAt(1), { auto: true }), reduced ? 450 : 1800);
    }
  });
  timeline.play(province);
  updateControls();
  if (!auto) setStatus('');
};

const showNation = () => {
  autoplay = false; autoplayPaused = false; timeline?.stop(); selected = null;
  root.classList.remove('is-detail'); root.dataset.stage = 'national'; mapState?.resetFocus(); clearFocusInfo(); updateControls();
};
const startAutoplay = () => { autoplay = true; autoplayPaused = false; currentIndex = 0; showDetail(model.ordered[0], { auto: true }); updateControls(); };

const bind = () => root.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'all') startAutoplay();
  if (action === 'back') showNation();
  if (action === 'replay' && selected) showDetail(selected, { auto: autoplay });
  if (action === 'prev' && selected) showDetail(provinceAt(-1), { auto: autoplay });
  if (action === 'next' && selected) showDetail(provinceAt(1), { auto: autoplay });
  if (action === 'pause') { autoplayPaused = true; timeline?.pause(); updateControls(); }
  if (action === 'resume') { autoplayPaused = false; timeline?.resume(); updateControls(); }
  if (action === 'poster') {
    try { await downloadPoster({ features, groups: model.groups, ordered: model.ordered }); }
    catch { setStatus('总图生成失败，请重试。', 'error'); }
  }
});

const renderShell = () => {
  root.classList.toggle('is-video-render', videoRender);
  root.innerHTML = `<header class="admissions-head"><div><p class="admissions-eyebrow">CLASS ADMISSIONS MAP</p><h1>班级同学蹭饭图</h1></div><div class="admissions-actions"><button data-action="all">播放</button><button data-action="poster">总图</button></div></header><p class="admissions-status" data-admissions-status aria-live="polite">正在加载…</p><section class="admissions-national"><div data-national-map></div><aside class="admissions-focus-info" data-focus-info aria-live="polite"></aside><p class="admissions-progress" data-progress></p><div class="admissions-detail-actions"><button data-action="replay">重播</button><button data-action="prev">上一个</button><button data-action="next">下一个</button><button data-action="pause" data-pause hidden>暂停</button><button data-action="resume" data-resume hidden>继续</button><button data-action="back">返回</button></div></section>`;
};

const installVideoTimeline = () => {
  if (!videoRender) return;
  const intro = 1800, outro = 3200;
  const segments = model.ordered.map((province) => ({ province, duration: Math.min(18000, 5800 + province.cities.length * 300 + province.universities.length * 1280) }));
  const total = intro + outro + segments.reduce((sum, segment) => sum + segment.duration, 0);
  window.ClassAdmissionsVideo = { durationMs: total, seek: async (time) => {
    const value = Math.max(0, Number(time) || 0);
    if (value < intro || value >= total - outro) { showNation(); return; }
    let cursor = intro, index = 0;
    while (index < segments.length - 1 && value >= cursor + segments[index].duration) cursor += segments[index++].duration;
    const segment = segments[index], phase = value - cursor;
    selected = segment.province; currentIndex = index; root.classList.add('is-detail'); mapState.resetFocus(); clearFocusInfo();
    mapState.focusTransform = mapState.focus(selected, { animate: false });
    if (phase >= 880) await prepareCities(selected);
    if (phase >= 1000) {
      const cities = Math.min(selected.cities.length, Math.floor((phase - 1000) / 300) + 1);
      for (let cityIndex = 0; cityIndex < cities; cityIndex += 1) await revealCity(selected, cityIndex);
    }
    const universitiesStart = 1000 + selected.cities.length * 300 + 180;
    if (phase >= universitiesStart) {
      const visible = Math.min(selected.universities.length, Math.floor((phase - universitiesStart) / 460) + 1);
      for (let universityIndex = 0; universityIndex < visible; universityIndex += 1) await renderUniversityMarker(selected, universityIndex);
      const handoffs = Math.min(visible, Math.floor((phase - universitiesStart - selected.universities.length * 460) / 820) + 1);
      for (let universityIndex = 0; universityIndex < Math.max(0, handoffs); universityIndex += 1) await handoffUniversity(selected, universityIndex);
    }
    updateControls();
  } };
};

const init = async () => {
  renderShell(); bind();
  try {
    [model, features] = await Promise.all([loadAdmissions(), loadGeo()]);
    const unmatched = [...model.groups.keys()].filter((code) => !features.some((feature) => feature.code === code));
    if (unmatched.length) throw new Error(`录取数据中的 ${unmatched.length} 个省份无法匹配地图行政区代码。`);
    mapState = renderNationalMap(root.querySelector('[data-national-map]'), features, model.groups, {
      onSelect: (province) => showDetail(province), onFocus: () => {}, renderProvinceInfo: renderProvinceAnnotation
    });
    updateControls(); installVideoTimeline(); setStatus('');
  } catch (error) { setStatus(error.message || '加载失败，请重试。', 'error'); }
};

init();

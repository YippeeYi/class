import { loadAdmissions } from './data.mjs';
import { featurePath, isCityBoundaryProvince, loadCityBoundaries, loadGeo } from './geo.mjs';
import { renderNationalMap } from './map.mjs';
import { brandNode, loadLogoUrl } from './assets.mjs';
import { downloadPoster } from './export.mjs';
import { ProvinceTimeline } from './timeline.mjs';

const root = document.getElementById('admissions-app');
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const videoRender = new URLSearchParams(location.search).get('render') === 'video';
const NS = 'http://www.w3.org/2000/svg';
const svg = (name, attrs = {}) => { const node = document.createElementNS(NS, name); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value)); return node; };
let model, features, mapState, selected = null, currentIndex = 0, autoplay = false, autoplayPaused = false, timeline;
const setStatus = (value, type = '') => { const node = root.querySelector('[data-admissions-status]'); if (node) { node.textContent = value; node.className = `admissions-status ${type}`; } };
const provinceAt = (offset) => model.ordered[(currentIndex + offset + model.ordered.length) % model.ordered.length];
const updateControls = () => { root.querySelector('[data-progress]')?.replaceChildren(document.createTextNode(selected ? `${currentIndex + 1} / ${model.ordered.length} · ${selected.name}` : '')); root.querySelector('[data-pause]')?.toggleAttribute('hidden', !autoplay); root.querySelector('[data-resume]')?.toggleAttribute('hidden', !autoplay || !autoplayPaused); };

const renderProvinceAnnotation = async (province) => {
  const fragment = document.createDocumentFragment();
  const heading = document.createElement('p'); heading.className = 'admissions-province-caption'; heading.textContent = province.name; fragment.append(heading);
  for (const university of province.universities) {
    const row = document.createElement('div'); row.className = 'admissions-map-university-row'; row.append(await brandNode(university));
    const names = document.createElement('span'); names.className = 'admissions-map-students'; names.textContent = university.students.map((student) => student.name).join('、'); row.append(names); fragment.append(row);
  }
  return fragment;
};

const clearFocusInfo = () => root.querySelector('[data-focus-info]')?.replaceChildren();
const renderFocusInfo = async (province, visible) => {
  const host = root.querySelector('[data-focus-info]'); if (!host) return; host.replaceChildren();
  for (const university of province.universities.slice(0, visible)) {
    const row = document.createElement('div'); row.className = 'admissions-focus-row is-visible';
    row.append(await brandNode(university, 'admissions-focus-brand'));
    const names = document.createElement('span'); names.className = 'admissions-focus-students'; names.textContent = university.students.map((student) => student.name).join('、'); row.append(names); host.append(row);
  }
};

const focusLayer = () => {
  let layer = mapState.svg.querySelector('.admissions-focus-layer');
  if (!layer) { layer = svg('g', { class: 'admissions-focus-layer' }); mapState.shapeLayer.append(layer); }
  return layer;
};
const renderCities = async (province) => {
  const layer = focusLayer(); layer.querySelectorAll('.admissions-city-marker, .admissions-city-boundary-layer').forEach((node) => node.remove());
  if (isCityBoundaryProvince(province.code)) {
    const boundaries = await loadCityBoundaries(province.code);
    if (boundaries.length) {
      const outlines = svg('g', { class: 'admissions-city-boundary-layer', 'aria-hidden': 'true' });
      boundaries.forEach((feature) => outlines.append(svg('path', { d: featurePath(feature, mapState.project) })));
      layer.append(outlines);
    }
  }
  province.cities.forEach((city) => {
    const [x, y] = mapState.project([city.longitude, city.latitude]); const group = svg('g', { class: 'admissions-city-marker' });
    group.append(svg('circle', { cx: x, cy: y, r: 5 }), svg('text', { x: x + 10, y: y - 9 })); group.lastChild.textContent = city.name; layer.append(group);
  });
};
const renderUniversityMarker = async (province, index) => {
  const university = province.universities[index]; if (!university) return;
  const layer = focusLayer(); const [x, y] = mapState.project([university.longitude, university.latitude]);
  let marker = layer.querySelector(`[data-university-id="${CSS.escape(university.id)}"]`);
  if (!marker) {
    marker = svg('g', { class: 'admissions-university-marker', 'data-university-id': university.id, transform: `translate(${x} ${y + 18})` });
    marker.append(svg('circle', { r: 25 })); const image = svg('image', { x: -20, y: -20, width: 40, height: 40, preserveAspectRatio: 'xMidYMid meet' }); marker.append(image); layer.append(marker);
    const url = await loadLogoUrl(university.logoPath); if (url) image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url);
    if (videoRender) marker.setAttribute('transform', `translate(${x} ${y})`);
    else { const rise = svg('animateTransform', { attributeName: 'transform', type: 'translate', from: `${x} ${y + 18}`, to: `${x} ${y}`, dur: '440ms', fill: 'freeze', calcMode: 'spline', keySplines: '.16 .84 .2 1' }); marker.append(rise); rise.beginElement?.(); }
  }
  requestAnimationFrame(() => marker.classList.add('is-visible'));
};
const moveMarkersToInfo = (province) => {
  const layer = focusLayer(); province.universities.forEach((university, index) => {
    const marker = layer.querySelector(`[data-university-id="${CSS.escape(university.id)}"]`); if (!marker) return;
    const [x, y] = mapState.project([university.longitude, university.latitude]); const transform = mapState.focusTransform || { scale: 1, dx: 0, dy: 0 }; const targetX = (1028 - transform.dx) / transform.scale, targetY = (195 + index * 82 - transform.dy) / transform.scale;
    if (videoRender) marker.setAttribute('transform', `translate(${targetX} ${targetY})`);
    else { const transition = svg('animateTransform', { attributeName: 'transform', type: 'translate', from: `${x} ${y}`, to: `${targetX} ${targetY}`, begin: `${index * 150}ms`, dur: '720ms', fill: 'freeze', calcMode: 'spline', keySplines: '.16 .84 .2 1' }); marker.append(transition); transition.beginElement?.(); }
    marker.dataset.origin = `${x},${y}`;
  });
};

const showDetail = (province, { auto = false } = {}) => {
  selected = province; currentIndex = model.ordered.findIndex((item) => item.code === province.code); root.classList.add('is-detail'); mapState.focusTransform = mapState.focus(province); clearFocusInfo(); updateControls();
  timeline?.stop(); timeline = new ProvinceTimeline({ reduced, onStage: async (stage, index) => {
    root.dataset.stage = stage;
    if (stage === 'cities') renderCities(province);
    if (stage === 'university') await renderUniversityMarker(province, index);
    if (stage === 'complete') { moveMarkersToInfo(province); window.setTimeout(() => renderFocusInfo(province, province.universities.length), reduced ? 0 : 200); }
  }, onFinish: () => { if (autoplay && !autoplayPaused) window.setTimeout(() => showDetail(provinceAt(1), { auto: true }), reduced ? 450 : 1800); } });
  timeline.play(province); if (!auto) setStatus('');
};
const showNation = () => { autoplay = false; autoplayPaused = false; timeline?.stop(); selected = null; root.classList.remove('is-detail'); root.dataset.stage = 'national'; mapState?.resetFocus(); clearFocusInfo(); updateControls(); };
const startAutoplay = () => { autoplay = true; autoplayPaused = false; currentIndex = 0; showDetail(model.ordered[0], { auto: true }); updateControls(); };

const bind = () => root.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action; if (!action) return;
  if (action === 'all') startAutoplay(); if (action === 'back') showNation(); if (action === 'replay' && selected) showDetail(selected, { auto: autoplay }); if (action === 'prev' && selected) showDetail(provinceAt(-1), { auto: autoplay }); if (action === 'next' && selected) showDetail(provinceAt(1), { auto: autoplay });
  if (action === 'pause') { autoplayPaused = true; timeline.pause(); updateControls(); } if (action === 'resume') { autoplayPaused = false; timeline.resume(); updateControls(); }
  if (action === 'poster') { try { await downloadPoster({ features, groups: model.groups, ordered: model.ordered }); } catch { setStatus('总图生成失败，请重试。', 'error'); } }
});
const renderShell = () => { root.classList.toggle('is-video-render', videoRender); root.innerHTML = `<header class="admissions-head"><div><p class="admissions-eyebrow">CLASS ADMISSIONS MAP</p><h1>班级同学蹭饭图</h1></div><div class="admissions-actions"><button data-action="all">播放</button><button data-action="poster">总图</button></div></header><p class="admissions-status" data-admissions-status aria-live="polite">正在加载…</p><section class="admissions-national"><div data-national-map></div><div class="admissions-focus-info" data-focus-info></div><p class="admissions-progress" data-progress></p><div class="admissions-detail-actions"><button data-action="replay">重播</button><button data-action="prev">上一个</button><button data-action="next">下一个</button><button data-action="pause" data-pause hidden>暂停</button><button data-action="resume" data-resume hidden>继续</button><button data-action="back">返回</button></div></section>`; };
const installVideoTimeline = () => {
  if (new URLSearchParams(location.search).get('render') !== 'video') return;
  const intro = 1800, outro = 3200;
  const segments = model.ordered.map((province) => {
    const markersEnd = 1600 + province.universities.length * 420;
    return { province, duration: Math.min(14000, Math.max(5200, markersEnd + 1750)) };
  });
  const total = intro + outro + segments.reduce((sum, segment) => sum + segment.duration, 0);
  window.ClassAdmissionsVideo = { durationMs: total, seek: async (time) => {
    const value = Math.max(0, Number(time) || 0);
    if (value < intro || value >= total - outro) { showNation(); return; }
    let cursor = intro, index = 0; while (index < segments.length - 1 && value >= cursor + segments[index].duration) cursor += segments[index++].duration;
    const segment = segments[index], phase = value - cursor, markersEnd = 1600 + segment.province.universities.length * 420;
    selected = segment.province; currentIndex = index; root.classList.add('is-detail'); mapState.resetFocus(); mapState.focusTransform = mapState.focus(selected); clearFocusInfo();
    if (phase >= 900) await renderCities(selected);
    if (phase >= 1600) {
      const visible = Math.min(selected.universities.length, Math.floor((phase - 1600) / 420) + 1);
      for (let markerIndex = 0; markerIndex < visible; markerIndex += 1) await renderUniversityMarker(selected, markerIndex);
    }
    if (phase >= markersEnd + 350) { moveMarkersToInfo(selected); await renderFocusInfo(selected, selected.universities.length); }
    updateControls();
  } };
};
const init = async () => { renderShell(); bind(); try { [model, features] = await Promise.all([loadAdmissions(), loadGeo()]); const unmatched = [...model.groups.keys()].filter((code) => !features.some((feature) => feature.code === code)); if (unmatched.length) throw new Error(`录取数据中的 ${unmatched.length} 个省份无法匹配地图行政区代码。`); mapState = renderNationalMap(root.querySelector('[data-national-map]'), features, model.groups, { onSelect: (province) => showDetail(province), onFocus: () => {}, renderProvinceInfo: renderProvinceAnnotation }); updateControls(); installVideoTimeline(); setStatus(''); } catch (error) { setStatus(error.message || '加载失败，请重试。', 'error'); } };
init();

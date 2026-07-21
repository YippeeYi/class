import { loadAdmissions } from './data.mjs';
import { loadGeo, createProjection, featurePath } from './geo.mjs';
import { renderNationalMap } from './map.mjs';
import { logoNode } from './assets.mjs';
import { downloadPoster } from './export.mjs';
import { ProvinceTimeline } from './timeline.mjs';

const root = document.getElementById('admissions-app');
const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let model, features, selected = null, currentIndex = 0, autoplay = false, autoplayPaused = false;
let timeline;
const setStatus = (value, type = '') => { const node = root.querySelector('[data-admissions-status]'); if (node) { node.textContent = value; node.className = `admissions-status ${type}`; } };
const provinceAt = (offset) => model.ordered[(currentIndex + offset + model.ordered.length) % model.ordered.length];
const updateControls = () => { root.querySelector('[data-progress]')?.replaceChildren(document.createTextNode(selected ? `${currentIndex + 1} / ${model.ordered.length} · ${selected.name}` : '全国地图')); root.querySelector('[data-pause]')?.toggleAttribute('hidden', !autoplay); root.querySelector('[data-resume]')?.toggleAttribute('hidden', !autoplay || !autoplayPaused); };
const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&quot;' })[char]);

const renderCards = async (province, stage = 'complete') => {
  const host = root.querySelector('[data-university-list]'); if (!host) return; host.replaceChildren();
  const visible = stage === 'university' ? province.universities.slice(0, Number(host.dataset.visible || 0) + 1) : province.universities;
  host.dataset.visible = String(visible.length);
  for (const university of visible) {
    const article = document.createElement('article'); article.className = 'admissions-university-card';
    const identity = document.createElement('div'); identity.className = 'admissions-university-identity'; identity.append(await logoNode(university));
    identity.insertAdjacentHTML('beforeend', `<div><h3>${escapeHtml(university.name)}</h3><p>${escapeHtml(university.city)}${university.campus ? ` · ${escapeHtml(university.campus)}` : ''}</p></div>`); article.append(identity);
    const students = document.createElement('ul'); students.className = 'admissions-student-list'; university.students.forEach((student) => { const item = document.createElement('li'); item.textContent = student.major ? `${student.name} · ${student.major}` : student.name; students.append(item); }); article.append(students); host.append(article);
  }
};

const renderDetailMap = (province, stage) => {
  const host = root.querySelector('[data-detail-map]'); if (!host) return; host.replaceChildren();
  const feature = features.find((item) => item.code === province.code); if (!feature) return;
  const project = createProjection([feature], 620, 480, 46), svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'admissions-detail-svg'); svg.setAttribute('viewBox', '0 0 620 480'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', featurePath(feature, project)); path.setAttribute('class', 'admissions-detail-province'); svg.append(path);
  if (stage === 'cities' || stage === 'university' || stage === 'complete' || reduced) province.cities.forEach((city) => { const [x, y] = project([city.longitude, city.latitude]); const group = document.createElementNS(svg.namespaceURI, 'g'); group.setAttribute('class', 'admissions-city-marker'); group.innerHTML = `<circle cx="${x}" cy="${y}" r="7"/><text x="${x + 12}" y="${y - 10}">${escapeHtml(city.name)}</text>`; svg.append(group); });
  host.append(svg);
};

const showDetail = (province, { auto = false } = {}) => {
  selected = province; currentIndex = model.ordered.findIndex((item) => item.code === province.code); root.classList.add('is-detail'); root.querySelector('[data-university-list]').dataset.visible = '0'; updateControls();
  timeline?.stop(); timeline = new ProvinceTimeline({ reduced, onStage: (stage) => { root.dataset.stage = stage; renderDetailMap(province, stage); if (stage === 'university') renderCards(province, stage); if (stage === 'complete') renderCards(province, stage); }, onFinish: () => { if (autoplay && !autoplayPaused) window.setTimeout(() => showDetail(provinceAt(1), { auto: true }), reduced ? 450 : 1500); } });
  timeline.play(province); if (!auto) setStatus(`${province.name}：${province.students} 名同学，${province.universities.length} 所大学。`);
};
const showNation = () => { autoplay = false; autoplayPaused = false; timeline?.stop(); selected = null; root.classList.remove('is-detail'); root.dataset.stage = 'national'; renderNationalMap(root.querySelector('[data-national-map]'), features, model.groups, { onSelect: (province) => showDetail(province), onFocus: (province, feature) => setStatus(province ? `${feature.name} · ${province.students} 人 · ${province.universities.length} 所大学 · ${province.cities.length} 个城市` : `${feature.name} · 暂无录取信息`) }); updateControls(); };
const startAutoplay = () => { autoplay = true; autoplayPaused = false; currentIndex = 0; showDetail(model.ordered[0], { auto: true }); updateControls(); };

const bind = () => root.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'all') startAutoplay();
  if (action === 'back') showNation();
  if (action === 'replay' && selected) showDetail(selected, { auto: autoplay });
  if (action === 'prev' && selected) showDetail(provinceAt(-1), { auto: autoplay });
  if (action === 'next' && selected) showDetail(provinceAt(1), { auto: autoplay });
  if (action === 'pause') { autoplayPaused = true; timeline.pause(); updateControls(); }
  if (action === 'resume') { autoplayPaused = false; timeline.resume(); updateControls(); }
  if (action === 'poster') { try { setStatus('正在生成高清总图…'); await downloadPoster({ features, groups: model.groups, ordered: model.ordered }); setStatus('总图已下载到本机。'); } catch { setStatus('总图生成失败，请重试。', 'error'); } }
});

const renderShell = () => { root.innerHTML = `<header class="admissions-head"><div><p class="admissions-eyebrow">CLASS ADMISSIONS MAP</p><h1>班级同学蹭饭图</h1><p>最终录取去向 · 仅在邀请码访问验证成功后加载</p></div><div class="admissions-actions"><button class="btn-action" data-action="all">播放全部省份</button><button class="btn-action" data-action="poster">导出总图</button></div></header><p class="admissions-status" data-admissions-status aria-live="polite">正在加载受保护的录取数据…</p><section class="admissions-national"><div data-national-map></div><div class="admissions-legend"><strong>录取人数</strong><span><i></i> 无录取信息</span><span><i></i> 少 → 多</span></div></section><section class="admissions-detail" aria-live="polite"><div class="admissions-detail-map-wrap"><div data-detail-map></div></div><div class="admissions-detail-info"><p data-progress></p><div data-university-list></div><div class="admissions-detail-actions"><button class="btn-action" data-action="replay">重新播放</button><button class="btn-action" data-action="prev">上一个省份</button><button class="btn-action" data-action="next">下一个省份</button><button class="btn-action" data-action="pause" data-pause hidden>暂停</button><button class="btn-action" data-action="resume" data-resume hidden>继续</button><button class="btn-action" data-action="back">返回全国地图</button></div></div></section>`; };

const installVideoTimeline = () => {
  if (new URLSearchParams(location.search).get('render') !== 'video') return;
  const intro = 1800, perProvince = 5200, outro = 3200, durationMs = intro + model.ordered.length * perProvince + outro;
  window.ClassAdmissionsVideo = {
    durationMs,
    seek: async (time) => {
      const value = Math.max(0, Number(time) || 0);
      if (value < intro || value >= intro + model.ordered.length * perProvince) { showNation(); setStatus(value >= intro ? '班级录取分布总览' : '班级同学蹭饭图'); return; }
      const local = value - intro, index = Math.min(model.ordered.length - 1, Math.floor(local / perProvince)), phase = local % perProvince;
      selected = model.ordered[index]; currentIndex = index; root.classList.add('is-detail'); root.dataset.stage = phase < 900 ? 'province' : phase < 1600 ? 'cities' : 'complete';
      renderDetailMap(selected, root.dataset.stage); await renderCards(selected, 'complete'); updateControls(); setStatus(`${index + 1} / ${model.ordered.length} · ${selected.name}`);
    }
  };
};
const init = async () => { renderShell(); bind(); try { [model, features] = await Promise.all([loadAdmissions(), loadGeo()]); const unmatched = [...model.groups.keys()].filter((code) => !features.some((feature) => feature.code === code)); if (unmatched.length) throw new Error(`录取数据中的 ${unmatched.length} 个省份无法匹配地图行政区代码。`); showNation(); installVideoTimeline(); setStatus(`已加载 ${model.rows.length} 条最终录取信息。`); } catch (error) { setStatus(error.message || '加载失败，请重试。', 'error'); } };
init();

import { logoInitial } from './core.mjs';

const urls = new Map();
export const loadLogoUrl = async (path) => {
  const safe = String(path || '').replace(/^\/+/, '');
  if (!safe || !/^images\/admissions\/[a-z0-9][a-z0-9/_-]{0,180}\.(png|jpe?g|webp|svg)$/i.test(safe)) return '';
  if (!urls.has(safe)) urls.set(safe, window.ClassRecordData?.signAssetUrl?.(safe, { expiresIn: 180, quiet: true }).catch(() => ''));
  return urls.get(safe);
};
export const logoNode = async (university, className = 'admissions-logo') => {
  const box = document.createElement('span'); box.className = className; box.setAttribute('aria-label', `${university.name}校徽`); box.textContent = logoInitial(university.name);
  const url = await loadLogoUrl(university.logoPath);
  if (!url) return box;
  const image = new Image(); image.alt = ''; image.decoding = 'async'; image.src = url;
  image.addEventListener('load', () => box.replaceChildren(image), { once: true });
  image.addEventListener('error', () => image.remove(), { once: true });
  return box;
};
export const brandNode = async (university, className = 'admissions-brand') => {
  const box = document.createElement('span');
  box.className = className;
  box.setAttribute('aria-label', `${university.name}校徽与标准字`);
  box.textContent = logoInitial(university.name);
  const url = await loadLogoUrl(university.brandPath || university.logoPath);
  if (!url) return box;
  const image = new Image(); image.alt = ''; image.decoding = 'async'; image.src = url;
  image.addEventListener('load', () => box.replaceChildren(image), { once: true });
  image.addEventListener('error', () => image.remove(), { once: true });
  return box;
};
export const clearLogoUrls = () => urls.clear();
window.addEventListener('classrecordcacheclearing', clearLogoUrls); window.addEventListener('pagehide', clearLogoUrls);

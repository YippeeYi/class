#!/usr/bin/env node
/*
 * Deterministic admission-map video renderer.
 * Requires Playwright + FFmpeg available locally. It never logs the access
 * token or page payload. Frames and MP4 are written to ignored folders.
 */
import { mkdir, rm } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const root = process.cwd(), token = process.env.CLASS_RECORD_ACCESS_TOKEN, baseUrl = process.env.CLASS_RECORD_VIDEO_URL || 'http://127.0.0.1:8765';
if (!token || !/^[a-f0-9]{64}$/i.test(token)) throw new Error('Set CLASS_RECORD_ACCESS_TOKEN locally to a valid access token; it is never accepted via command arguments.');
let chromium; try { ({ chromium } = require('playwright')); } catch { throw new Error('Playwright is required. Install it locally (not in the deployed site) before rendering.'); }
const ffmpegCheck = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', shell: process.platform === 'win32' });
if (ffmpegCheck.status !== 0) throw new Error('FFmpeg is required. Install FFmpeg locally and ensure `ffmpeg -version` succeeds before rendering.');
const output = path.join(root, 'admissions-output'), frames = path.join(root, 'admissions-frames'); await rm(frames, { recursive: true, force: true }); await mkdir(frames, { recursive: true }); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.addInitScript(({ accessToken }) => { localStorage.setItem('classRecord:inviteAccess', JSON.stringify({ type: 'invite', token: accessToken, authorizedAt: new Date().toISOString() })); localStorage.setItem('classRecord:lastVisitAt', new Date().toISOString()); }, { accessToken: token });
  await page.goto(`${baseUrl}/admissions.html?render=video`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.admissions-map-svg');
  await page.waitForFunction(() => Boolean(window.ClassAdmissionsVideo?.durationMs), { timeout: 30000 });
  // Fixed 30 fps sampling. The page controls a deterministic seek API when
  // render=video; no wall-clock recording is used.
  const duration = await page.evaluate(() => window.ClassAdmissionsVideo?.durationMs || 0);
  if (!duration) throw new Error('Video timeline is unavailable; map data may be empty.');
  for (let frame = 0, time = 0; time <= duration; frame += 1, time = Math.round(frame * 1000 / 30)) {
    await page.evaluate((value) => window.ClassAdmissionsVideo.seek(value), time);
    await page.screenshot({ path: path.join(frames, `frame-${String(frame).padStart(6, '0')}.png`) });
  }
} finally { await browser.close(); }
await new Promise((resolve, reject) => { const process = spawn('ffmpeg', ['-y', '-framerate', '30', '-i', path.join(frames, 'frame-%06d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(output, 'class-admissions-map.mp4')], { stdio: 'inherit' }); process.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited with ${code}`))); });
console.log('Video written to admissions-output/class-admissions-map.mp4');

#!/usr/bin/env node
/*
 * migrate-secure-content.mjs
 * 将本地 data/ 和 images/ 迁移到 Supabase RLS 表 + 私有 Storage。
 * 需要 Node.js 18+，无需安装依赖。
 *
 * PowerShell 用法：
 *   $env:SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="你的 service_role key"
 *   node scripts/migrate-secure-content.mjs
 *   node scripts/migrate-secure-content.mjs --prune
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.CLASS_RECORD_BUCKET || 'classrecord-private';
const shouldPrune = process.argv.includes('--prune');

if (!url || !serviceRoleKey) {
  console.error('缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。');
  process.exit(1);
}

const baseUrl = url.replace(/\/$/, '');
const authHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`
};

const request = async (endpoint, options = {}) => {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${options.method || 'GET'} ${endpoint} failed: ${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
const exists = async (relativePath) => fs.access(path.join(root, relativePath)).then(() => true).catch(() => false);
const quoteList = (values) => `(${values.map((value) => `"${String(value).replace(/"/g, '\\"')}"`).join(',')})`;

const upsert = async (table, rows, onConflict) => {
  if (!rows.length) return;
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await request(`/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(batch)
    });
    console.log(`已写入 ${table}: ${Math.min(i + batch.length, rows.length)} / ${rows.length}`);
  }
};

const pruneTable = async (table, keyColumn, keepValues) => {
  if (!shouldPrune) return;
  if (!keepValues.length) {
    console.warn(`跳过 ${table} 清理：本地保留列表为空。`);
    return;
  }
  await request(`/rest/v1/${table}?${keyColumn}=not.in.${encodeURIComponent(quoteList(keepValues))}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });
  console.log(`已清理 ${table} 中本地不存在的行。`);
};

const importRecords = async () => {
  const files = await readJson('data/record/records_index.json');
  const rows = [];
  for (const [index, fileName] of files.entries()) {
    const raw = await readJson(`data/record/${fileName}`);
    rows.push({
      file_name: fileName,
      record_id: raw.id || `R${String(index + 1).padStart(3, '0')}`,
      record_date: fileName.slice(0, 10),
      record_time: raw.time || null,
      author: raw.author || '',
      content: raw.content || '',
      importance: raw.importance || 'normal',
      attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
      record_index: index,
      raw
    });
  }
  await upsert('class_records', rows, 'file_name');
  await pruneTable('class_records', 'file_name', files);
};

const importPeople = async () => {
  const files = await readJson('data/people/people_index.json');
  const rows = [];
  for (const [index, fileName] of files.entries()) {
    const raw = await readJson(`data/people/${fileName}`);
    rows.push({
      id: raw.id || fileName.replace(/\.json$/i, ''),
      alias: raw.alias || '',
      role: raw.role || 'student',
      bio: raw.bio || '',
      sort_order: index,
      raw
    });
  }
  await upsert('class_people', rows, 'id');
  await pruneTable('class_people', 'id', rows.map((row) => row.id));
};

const importGlossary = async () => {
  const files = await readJson('data/glossary/glossary_index.json');
  const rows = [];
  for (const [index, fileName] of files.entries()) {
    const raw = await readJson(`data/glossary/${fileName}`);
    rows.push({
      id: raw.id || fileName.replace(/\.json$/i, ''),
      label: raw.label || raw.name || raw.title || fileName.replace(/\.json$/i, ''),
      definition: raw.definition || raw.content || '',
      sort_order: index,
      raw
    });
  }
  await upsert('class_glossary', rows, 'id');
  await pruneTable('class_glossary', 'id', rows.map((row) => row.id));
};

const importRecordPages = async () => {
  if (!(await exists('data/record/record_pages.json'))) return;
  const pages = await readJson('data/record/record_pages.json');
  const rows = pages.map((raw, index) => ({
    page: String(raw.page || raw.id || String(index + 1).padStart(2, '0')),
    start_file: raw.start || raw.startFile || raw.from || null,
    end_file: raw.end || raw.endFile || raw.to || null,
    sort_order: index,
    raw
  }));
  await upsert('class_record_pages', rows, 'page');
  await pruneTable('class_record_pages', 'page', rows.map((row) => row.page));
};

const importQuiz = async () => {
  if (!(await exists('data/quiz/lamian.json'))) return;
  const raw = await readJson('data/quiz/lamian.json');
  const items = Array.isArray(raw) ? raw : (Array.isArray(raw.questions) ? raw.questions : []);
  const rows = items.map((item, index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      id: item.id || `LAMIAN-${number}`,
      question_group: 'lamian',
      prompt: item.prompt || '请根据图片填写答案。',
      answer: String(item.answer || '').trim(),
      image_path: item.image || `images/quiz/lamian/${number}.png`,
      sort_order: index,
      raw: item
    };
  }).filter((row) => row.answer);
  await upsert('class_quiz_questions', rows, 'id');
  await pruneTable('class_quiz_questions', 'id', rows.map((row) => row.id));
};

const walkFiles = async (dir) => {
  const absolute = path.join(root, dir);
  if (!(await exists(dir))) return [];
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const relative = path.join(dir, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) return walkFiles(relative);
    if (entry.isFile()) return [relative];
    return [];
  }));
  return files.flat();
};

const contentTypeFor = (file) => {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.json') return 'application/json';
  return 'application/octet-stream';
};

const listStorageObjects = async (prefix = '') => {
  const rows = await request(`/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } })
  }) || [];
  const output = [];
  for (const row of rows) {
    const name = prefix ? `${prefix}/${row.name}` : row.name;
    if (row.metadata === null) {
      output.push(...await listStorageObjects(name));
    } else {
      output.push(name);
    }
  }
  return output;
};

const pruneStorage = async (localFiles) => {
  if (!shouldPrune) return;
  const keep = new Set(localFiles);
  const remoteFiles = [...await listStorageObjects('data'), ...await listStorageObjects('images')];
  const stale = remoteFiles.filter((file) => !keep.has(file));
  if (!stale.length) {
    console.log('私有 Storage 无需清理。');
    return;
  }
  const batchSize = 100;
  for (let i = 0; i < stale.length; i += batchSize) {
    const batch = stale.slice(i, i + batchSize);
    await request(`/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: batch })
    });
    console.log(`已删除私有 Storage 旧文件 ${Math.min(i + batch.length, stale.length)} / ${stale.length}`);
  }
};

const uploadPrivateFiles = async () => {
  const files = [...await walkFiles('data'), ...await walkFiles('images')];
  const uploadable = files.filter((file) => !file.endsWith('.md') && !file.endsWith('README.md'));
  for (const [index, file] of uploadable.entries()) {
    const body = await fs.readFile(path.join(root, file));
    await request(`/storage/v1/object/${bucket}/${file}`, {
      method: 'POST',
      headers: {
        'Content-Type': contentTypeFor(file),
        'Cache-Control': '3600',
        'x-upsert': 'true'
      },
      body
    });
    console.log(`已上传私有文件 ${index + 1} / ${uploadable.length}: ${file}`);
  }
  await pruneStorage(uploadable);
};

await importRecords();
await importPeople();
await importGlossary();
await importRecordPages();
await importQuiz();
await uploadPrivateFiles();
console.log(shouldPrune ? '迁移完成，并已同步删除远端旧内容。' : '迁移完成。部署时请不要发布 data/ 和 images/ 目录。');

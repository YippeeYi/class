#!/usr/bin/env node
/*
 * migrate-secure-content.mjs
 *
 * Migrates local secure content into Supabase.
 *
 * This version does NOT require:
 *   - data/record/records_index.json
 *   - data/people/people_index.json
 *   - data/glossary/glossary_index.json
 *
 * It imports structured rows by scanning:
 *   - data/record/*.json
 *   - data/people/*.json
 *   - data/glossary/*.json
 *
 * It still uploads files under:
 *   - data/
 *   - images/record-pages/
 *
 * Markdown files are excluded from upload:
 *   - *.md
 *
 * PowerShell:
 *   $env:SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="your service_role key"
 *   $env:CLASS_RECORD_BUCKET="classrecord-private"
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
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const baseUrl = url.replace(/\/$/, '');
const authHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
};

const normalizeSlash = (value) => String(value || '').replace(/\\/g, '/');

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

const exists = async (relativePath) => {
    return fs.access(path.join(root, relativePath)).then(() => true).catch(() => false);
};

const readJson = async (relativePath) => {
    return JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
};

const quoteList = (values) => {
    return `(${values.map((value) => `"${String(value).replace(/"/g, '\\"')}"`).join(',')})`;
};

const trimExt = (value) => {
    return String(value || '').replace(/\.(png|jpe?g|webp|gif)$/i, '');
};

const firstValue = (...values) => {
    return values.find((value) => value !== undefined && value !== null && value !== '');
};

const stableSort = (values) => {
    return [...values].sort((a, b) => {
        return a.localeCompare(b, 'zh-Hans-CN', {
            numeric: true,
            sensitivity: 'base'
        });
    });
};

const relativeFromDir = (dir, file) => {
    return normalizeSlash(path.relative(path.join(root, dir), path.join(root, file)));
};

const fileBaseNameWithoutExt = (file) => {
    return normalizeSlash(file)
        .split('/')
        .pop()
        .replace(/\.json$/i, '');
};

const isMarkdownFile = (file) => {
    return normalizeSlash(file).toLowerCase().endsWith('.md');
};

const normalizeRecordPageImagePath = (value, fallbackPage) => {
    const raw = String(value || '').trim();

    if (/^https?:\/\//i.test(raw)) {
        return raw.replace(/\.jpg(\?|#|$)/i, '.jpeg$1');
    }

    const source = raw || (fallbackPage ? String(fallbackPage) : '');
    if (!source) return null;

    const clean = source
        .replace(/^\/+/, '')
        .replace(/^images\/record-pages\//i, '')
        .replace(/^record-pages\//i, '');

    return `images/record-pages/${trimExt(clean)}.jpeg`;
};

const walkFiles = async (dir) => {
    const absolute = path.join(root, dir);

    if (!(await exists(dir))) return [];

    const entries = await fs.readdir(absolute, { withFileTypes: true });

    const files = await Promise.all(entries.map(async (entry) => {
        const relative = normalizeSlash(path.join(dir, entry.name));

        if (entry.isDirectory()) {
            return walkFiles(relative);
        }

        if (entry.isFile()) {
            return [relative];
        }

        return [];
    }));

    return files.flat();
};

const listJsonFiles = async (dir, excludedFiles = []) => {
    const excluded = new Set(excludedFiles.map(normalizeSlash));
    const files = await walkFiles(dir);

    return stableSort(files.filter((file) => {
        const normalized = normalizeSlash(file);
        return normalized.toLowerCase().endsWith('.json') && !excluded.has(normalized);
    }));
};

const contentTypeFor = (file) => {
    const ext = path.extname(file).toLowerCase();

    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.json') return 'application/json';
    if (ext === '.css') return 'text/css';
    if (ext === '.js' || ext === '.mjs') return 'text/javascript';
    if (ext === '.html') return 'text/html';
    if (ext === '.txt') return 'text/plain';

    return 'application/octet-stream';
};

const assertUnique = (rows, key, table) => {
    const seen = new Set();

    for (const row of rows) {
        const value = row[key];

        if (seen.has(value)) {
            throw new Error(`Duplicate ${table}.${key} value detected: ${value}`);
        }

        seen.add(value);
    }
};

const upsert = async (table, rows, onConflict) => {
    if (!rows.length) {
        console.warn(`Skipped ${table}: no rows to upsert.`);
        return;
    }

    assertUnique(rows, onConflict, table);

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

        console.log(`Upserted ${table}: ${Math.min(i + batch.length, rows.length)} / ${rows.length}`);
    }
};

const pruneTable = async (table, keyColumn, keepValues) => {
    if (!shouldPrune) return;

    if (!keepValues.length) {
        console.warn(`Skipped pruning ${table}: keep list is empty.`);
        return;
    }

    await request(`/rest/v1/${table}?${keyColumn}=not.in.${encodeURIComponent(quoteList(keepValues))}`, {
        method: 'DELETE',
        headers: {
            Prefer: 'return=minimal'
        }
    });

    console.log(`Pruned stale rows from ${table}.`);
};

const importRecords = async () => {
    const files = await listJsonFiles('data/record', [
        'data/record/record_pages.json'
    ]);

    if (!files.length) {
        console.warn('Skipped records: no record JSON files found in data/record/.');
        return;
    }

    const rows = [];
    let visibleIndex = 0;
    let hiddenIndex = 0;

    for (const file of files) {
        const raw = await readJson(file);
        const fileName = relativeFromDir('data/record', file);

        const isHidden = Boolean(raw.hidden);
        const index = isHidden ? hiddenIndex++ : visibleIndex++;
        const recordId = raw.id || raw.recordId || `R${String(index + 1).padStart(3, '0')}`;

        rows.push({
            file_name: fileName,
            record_id: recordId,
            record_date: raw.date || fileBaseNameWithoutExt(fileName).slice(0, 10),
            record_time: raw.time || null,
            author: raw.author || raw.recorder || '',
            content: raw.content || raw.text || '',
            importance: raw.importance || 'normal',
            attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
            record_index: index,
            hidden: isHidden,
            image_path: normalizeRecordPageImagePath(
                firstValue(raw.image_path, raw.imagePath, raw.image, raw.pageImage),
                raw.page
            ),
            raw
        });
    }

    await upsert('class_records', rows, 'file_name');
    await pruneTable('class_records', 'file_name', rows.map((row) => row.file_name));
};

const importPeople = async () => {
    const files = await listJsonFiles('data/people');

    if (!files.length) {
        console.warn('Skipped people: no people JSON files found in data/people/.');
        return;
    }

    const rows = [];

    for (const [index, file] of files.entries()) {
        const raw = await readJson(file);
        const fileName = relativeFromDir('data/people', file);
        const aliases = Array.isArray(raw.aliases) ? raw.aliases : (raw.alias ? [raw.alias] : []);

        rows.push({
            id: raw.id || fileBaseNameWithoutExt(fileName),
            name: raw.name || raw.displayName || raw.display_name || '',
            alias: raw.alias || aliases.join(', '),
            aliases,
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
    const files = await listJsonFiles('data/glossary');

    if (!files.length) {
        console.warn('Skipped glossary: no glossary JSON files found in data/glossary/.');
        return;
    }

    const rows = [];

    for (const [index, file] of files.entries()) {
        const raw = await readJson(file);
        const fileName = relativeFromDir('data/glossary', file);
        const fallbackId = fileBaseNameWithoutExt(fileName);

        rows.push({
            id: raw.id || fallbackId,
            label: raw.label || raw.name || raw.title || raw.term || fallbackId,
            definition: raw.definition || raw.content || raw.description || '',
            sort_order: index,
            raw
        });
    }

    await upsert('class_glossary', rows, 'id');
    await pruneTable('class_glossary', 'id', rows.map((row) => row.id));
};

const importRecordPages = async () => {
    if (!(await exists('data/record/record_pages.json'))) {
        console.warn('Skipped record pages: data/record/record_pages.json not found.');
        return;
    }

    const rawPages = await readJson('data/record/record_pages.json');
    const pages = Array.isArray(rawPages) ? rawPages : (Array.isArray(rawPages.pages) ? rawPages.pages : []);

    if (!pages.length) {
        console.warn('Skipped record pages: no pages found.');
        return;
    }

    let visibleIndex = 0;
    let hiddenIndex = 0;

    const rows = pages.map((raw) => {
        const isHidden = Boolean(raw.hidden);
        const index = isHidden ? hiddenIndex++ : visibleIndex++;
        const page = String(raw.page || raw.id || String(index + 1).padStart(2, '0'));

        return {
            page,
            start_file: raw.start || raw.startFile || raw.from || null,
            end_file: raw.end || raw.endFile || raw.to || null,
            sort_order: index,
            hidden: isHidden,
            image_path: normalizeRecordPageImagePath(
                firstValue(raw.image_path, raw.imagePath, raw.image, raw.fileName, raw.file),
                page
            ),
            raw
        };
    });

    await upsert('class_record_pages', rows, 'page');
    await pruneTable('class_record_pages', 'page', rows.map((row) => row.page));
};

const importQuiz = async () => {
    if (!(await exists('data/quiz/lamian.json'))) {
        console.warn('Skipped quiz: data/quiz/lamian.json not found.');
        return;
    }

    const raw = await readJson('data/quiz/lamian.json');
    const items = Array.isArray(raw) ? raw : (Array.isArray(raw.questions) ? raw.questions : []);

    if (!items.length) {
        console.warn('Skipped quiz: no quiz questions found.');
        return;
    }

    const rows = items.map((item, index) => {
        const number = String(index + 1).padStart(2, '0');

        return {
            id: item.id || `LAMIAN-${number}`,
            question_group: 'lamian',
            prompt: item.prompt || 'Hidden question',
            answer: String(item.answer || '').trim(),
            image_path: item.image_path || item.imagePath || item.image || `images/quiz/lamian/${number}.png`,
            sort_order: index,
            raw: item
        };
    }).filter((row) => row.answer);

    await upsert('class_quiz_questions', rows, 'id');
    await pruneTable('class_quiz_questions', 'id', rows.map((row) => row.id));
};

const listStorageObjects = async (prefix = '') => {
    const rows = await request(`/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prefix,
            limit: 1000,
            offset: 0,
            sortBy: {
                column: 'name',
                order: 'asc'
            }
        })
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

    const remoteFiles = [
        ...await listStorageObjects('data'),
        ...await listStorageObjects('images/record-pages')
    ];

    const stale = remoteFiles.filter((file) => !keep.has(file));

    if (!stale.length) {
        console.log('Storage prune skipped: no stale files.');
        return;
    }

    const batchSize = 100;

    for (let i = 0; i < stale.length; i += batchSize) {
        const batch = stale.slice(i, i + batchSize);

        await request(`/storage/v1/object/${bucket}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prefixes: batch
            })
        });

        console.log(`Deleted stale Storage files: ${Math.min(i + batch.length, stale.length)} / ${stale.length}`);
    }
};

const uploadPrivateFiles = async () => {
    const files = stableSort([
        ...await walkFiles('data'),
        ...await walkFiles('images/record-pages')
    ]);

    const uploadable = files.filter((file) => !isMarkdownFile(file));

    if (!uploadable.length) {
        console.warn('Skipped private file upload: no uploadable files found under data/ or images/record-pages/.');
        return;
    }

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

        console.log(`Uploaded private file ${index + 1} / ${uploadable.length}: ${file}`);
    }

    await pruneStorage(uploadable);
};

await importRecords();
await importPeople();
await importGlossary();
await importRecordPages();
await importQuiz();
await uploadPrivateFiles();

console.log(shouldPrune ? 'Migration complete. Remote stale data/files were pruned.' : 'Migration complete.');

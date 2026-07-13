#!/usr/bin/env node
/*
 * migrate-secure-content.mjs
 *
 * Migrates local secure content into Supabase.
 *
 * This version does NOT require:
 *   - data/record/records_index.json
 *   - data/people/people_index.json
 *
 * It imports structured rows by scanning:
 *   - data/record/*.json
 *   - data/people/*.json
 *   - data/page-supplements/*.json
 *   - data/materials/*.json
 *
 * Storage uploads are reference-driven. Only binary assets referenced by the
 * imported database rows are uploaded; source JSON is never copied to Storage.
 * Quiz images are read from the ignored local private-assets/ directory.
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
const hiddenStoragePrefix = 'hidden/';
const allowedStorageRoots = ['data/attachments/', 'images/record-pages/', 'images/quiz/'];
const allowedStorageExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg',
    '.pdf', '.txt', '.zip', '.mp3', '.wav', '.ogg', '.mp4', '.webm'
]);
const storageUploadManifest = new Map();
const requiredDatabaseColumns = {
    class_quiz_questions: [
        'id', 'content_key', 'question_group', 'question_type', 'prompt',
        'choices', 'answer', 'explanation', 'image_path', 'sort_order', 'raw'
    ]
};

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

const validateDatabaseSchema = async () => {
    const specification = await request('/rest/v1/', {
        headers: { Accept: 'application/openapi+json' }
    });
    const definitions = specification?.definitions || specification?.components?.schemas || {};
    const missing = [];

    for (const [table, requiredColumns] of Object.entries(requiredDatabaseColumns)) {
        const properties = definitions?.[table]?.properties || {};
        for (const column of requiredColumns) {
            if (!Object.prototype.hasOwnProperty.call(properties, column)) {
                missing.push(`${table}.${column}`);
            }
        }
    }

    if (missing.length) {
        throw new Error(
            `Supabase schema is missing required migration columns: ${missing.join(', ')}. `
            + 'Run docs/supabase-setup.sql in Supabase SQL Editor, then retry this command.'
        );
    }
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

const parsePageSupplementFileName = (file) => {
    const baseName = fileBaseNameWithoutExt(file);
    const match = /^(\d{2,3})-(\d{2,3})$/.exec(baseName);
    if (!match) return null;
    return {
        page: match[1],
        supplementIndex: Number(match[2])
    };
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

const normalizeAllowedStoragePath = (value, fallbackRoot = '') => {
    const raw = normalizeSlash(String(value || '').trim()).replace(/^\/+/, '');
    if (!raw || /^https?:\/\//i.test(raw) || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
    const withoutHiddenPrefix = raw.startsWith(hiddenStoragePrefix) ? raw.slice(hiddenStoragePrefix.length) : raw;
    const candidate = withoutHiddenPrefix.includes('/') ? withoutHiddenPrefix : `${fallbackRoot}${withoutHiddenPrefix}`;
    const segments = candidate.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return null;
    if (!allowedStorageRoots.some((prefix) => candidate.startsWith(prefix))) return null;
    if (!allowedStorageExtensions.has(path.extname(candidate).toLowerCase())) return null;
    return candidate;
};

const getDefaultLocalAssetPath = (storagePath) => {
    if (storagePath.startsWith('images/quiz/')) {
        return `private-assets/${storagePath.slice('images/'.length)}`;
    }
    return storagePath;
};

const registerStorageAsset = (value, { hidden = false, fallbackRoot = '', localPath = '' } = {}) => {
    if (/^https?:\/\//i.test(String(value || '').trim())) return String(value).trim();
    const storagePath = normalizeAllowedStoragePath(value, fallbackRoot);
    if (!storagePath) {
        throw new Error(`Storage asset path is outside the upload allowlist: ${value}`);
    }
    const remotePath = hidden ? `${hiddenStoragePrefix}${storagePath}` : storagePath;
    const sourcePath = normalizeSlash(localPath || getDefaultLocalAssetPath(storagePath));
    storageUploadManifest.set(remotePath, { localPath: sourcePath, remotePath });
    return remotePath;
};

const rewriteMarkupAssets = (value, { hidden = false } = {}) => {
    return String(value || '').replace(/\[\[illu:([^|\]\r\n]+)\|/g, (match, markerPath) => {
        const rawMarker = String(markerPath || '').trim().replace(/^hidden\//, '');
        if (!rawMarker || rawMarker.includes('/') || rawMarker.includes('\\')) return match;
        registerStorageAsset(rawMarker, { hidden, fallbackRoot: 'data/attachments/' });
        return `[[illu:${hidden ? 'hidden/' : ''}${rawMarker}|`;
    });
};

const rewriteMarkupAssetsDeep = (value, options) => {
    if (typeof value === 'string') return rewriteMarkupAssets(value, options);
    if (Array.isArray(value)) return value.map((item) => rewriteMarkupAssetsDeep(item, options));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteMarkupAssetsDeep(item, options)]));
    }
    return value;
};

const rewriteAttachments = (value, { hidden = false } = {}) => {
    if (!Array.isArray(value)) return [];
    return value.map((attachment) => {
        if (!attachment || typeof attachment !== 'object' || !attachment.file) return attachment;
        return {
            ...attachment,
            file: registerStorageAsset(attachment.file, { hidden, fallbackRoot: 'data/attachments/' })
        };
    });
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
    if (ext === '.svg') return 'image/svg+xml';
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.txt') return 'text/plain';
    if (ext === '.zip') return 'application/zip';
    if (ext === '.mp3') return 'audio/mpeg';
    if (ext === '.wav') return 'audio/wav';
    if (ext === '.ogg') return 'audio/ogg';
    if (ext === '.mp4') return 'video/mp4';
    if (ext === '.webm') return 'video/webm';

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
    const files = (await listJsonFiles('data/record', [
        'data/record/record_pages.json'
    ])).filter((file) => !parsePageSupplementFileName(file));

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
        const content = rewriteMarkupAssets(raw.content || raw.text || '', { hidden: isHidden });
        const attachments = rewriteAttachments(raw.attachments, { hidden: isHidden });
        const sourceImagePath = normalizeRecordPageImagePath(
            firstValue(raw.image_path, raw.imagePath, raw.image, raw.pageImage),
            raw.page
        );

        rows.push({
            file_name: fileName,
            record_id: recordId,
            record_date: raw.date || fileBaseNameWithoutExt(fileName).slice(0, 10),
            record_time: raw.time || null,
            author: raw.author || raw.recorder || '',
            content,
            importance: raw.importance || 'normal',
            attachments,
            record_index: index,
            hidden: isHidden,
            image_path: sourceImagePath ? registerStorageAsset(sourceImagePath, { hidden: isHidden }) : null,
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
        const avatarSource = firstValue(raw.avatar_url, raw.avatarUrl, raw.avatar);

        rows.push({
            id: raw.id || fileBaseNameWithoutExt(fileName),
            name: raw.name || raw.displayName || raw.display_name || '',
            alias: raw.alias || aliases.join(', '),
            aliases,
            role: raw.role || 'student',
            subject: raw.subject == null || raw.subject === '' ? null : String(raw.subject),
            main: raw.main === true,
            bio: raw.bio || '',
            avatar_url: avatarSource
                ? registerStorageAsset(avatarSource, { fallbackRoot: 'data/attachments/' })
                : null,
            sort_order: index,
            raw
        });
    }

    await upsert('class_people', rows, 'id');
    await pruneTable('class_people', 'id', rows.map((row) => row.id));
};

const importPageSupplements = async () => {
    const files = (await listJsonFiles('data/page-supplements'))
        .filter(parsePageSupplementFileName);

    if (!files.length) {
        console.warn('Skipped page supplements: no page-number supplement JSON files found in data/page-supplements/.');
        return;
    }

    const rows = [];
    for (const file of files) {
        const parsed = parsePageSupplementFileName(file);
        const raw = await readJson(file);
        const isHidden = raw.hidden === true;
        const content = rewriteMarkupAssets(raw.content || raw.text || '', { hidden: isHidden }).trim();
        if (!content) {
            console.warn(`Skipped page supplement without content: ${file}`);
            continue;
        }
        rows.push({
            file_name: relativeFromDir('data/page-supplements', file),
            page: parsed.page,
            supplement_index: parsed.supplementIndex,
            author: raw.author || raw.recorder || '',
            content,
            hidden: isHidden,
            sort_order: parsed.supplementIndex,
            raw
        });
    }

    await upsert('class_page_supplements', rows, 'file_name');
    await pruneTable('class_page_supplements', 'file_name', rows.map((row) => row.file_name));
};

const importMaterials = async () => {
    const files = await listJsonFiles('data/materials');
    if (!files.length) {
        console.warn('Skipped materials: no material JSON files found in data/materials/.');
        return;
    }

    const rows = [];
    for (const [index, file] of files.entries()) {
        const raw = await readJson(file);
        const fileName = relativeFromDir('data/materials', file);
        const fallbackId = fileBaseNameWithoutExt(fileName);
        const title = String(raw.title || raw.name || fallbackId).trim();
        const content = rewriteMarkupAssets(raw.content || raw.description || '').trim();
        if (!title || !content) {
            console.warn(`Skipped material without title/content: ${file}`);
            continue;
        }
        rows.push({
            id: fallbackId,
            material_id: raw.id || fallbackId,
            title,
            content,
            sort_order: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : index,
            raw
        });
    }

    await upsert('class_materials', rows, 'id');
    await pruneTable('class_materials', 'id', rows.map((row) => row.id));
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
        const sourceImagePath = normalizeRecordPageImagePath(
            firstValue(raw.image_path, raw.imagePath, raw.image, raw.fileName, raw.file),
            page
        );

        return {
            page,
            start_file: raw.start || raw.startFile || raw.from || null,
            end_file: raw.end || raw.endFile || raw.to || null,
            sort_order: index,
            hidden: isHidden,
            image_path: sourceImagePath ? registerStorageAsset(sourceImagePath, { hidden: isHidden }) : null,
            raw
        };
    });

    await upsert('class_record_pages', rows, 'page');
    await pruneTable('class_record_pages', 'page', rows.map((row) => row.page));
};

const importPageMessages = async () => {
    const files = await listJsonFiles('data/messages');
    if (!files.length) {
        console.warn('Skipped page messages: no JSON files found in data/messages/.');
        return;
    }

    const rows = [];
    for (const file of files) {
        const raw = await readJson(file);
        const page = fileBaseNameWithoutExt(file);
        const content = rewriteMarkupAssets(raw.content || '').trim();
        if (!content) {
            console.warn(`Skipped page message without content: ${file}`);
            continue;
        }
        rows.push({
            page,
            content,
            author: raw.author || raw.recorder || '',
            raw
        });
    }

    await upsert('class_page_messages', rows, 'page');
    await pruneTable('class_page_messages', 'page', rows.map((row) => row.page));
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
        const imagePath = item.image_path || item.imagePath || item.image || `images/quiz/lamian/${number}.png`;

        return {
            id: item.id || `LAMIAN-${number}`,
            content_key: 'lamian',
            question_group: 'lamian',
            question_type: 'fill',
            prompt: item.prompt || 'Hidden question',
            answer: String(item.answer || '').trim(),
            image_path: registerStorageAsset(imagePath),
            sort_order: index,
            raw: item
        };
    }).filter((row) => row.answer);

    await upsert('class_quiz_questions', rows, 'id');
    await pruneTable('class_quiz_questions', 'id', rows.map((row) => row.id));
};

const normalizeCreditsTextList = (value) => {
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
    const text = String(value || '').trim();
    return text ? [text] : [];
};

const importCreditsPage = async () => {
    if (!(await exists('data/credits-page.json'))) {
        console.warn('Skipped credits page: data/credits-page.json not found.');
        return;
    }

    const raw = rewriteMarkupAssetsDeep(await readJson('data/credits-page.json'));
    const sections = Array.isArray(raw.sections) ? raw.sections : [];
    const thanks = normalizeCreditsTextList(raw.thanks);
    const originalImages = Array.isArray(raw.originalImages)
        ? raw.originalImages
        : (Array.isArray(raw.original_images) ? raw.original_images : []);

    await upsert('class_credits_page', [{
        id: 'main',
        title: String(raw.title || '制作组与致谢').trim(),
        sections,
        thanks,
        original_images: originalImages,
        raw,
        updated_at: new Date().toISOString()
    }], 'id');
};

const listStorageObjects = async (prefix = '') => {
    const rows = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
        const pageRows = await request(`/storage/v1/object/list/${bucket}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prefix,
                limit: pageSize,
                offset,
                sortBy: {
                    column: 'name',
                    order: 'asc'
                }
            })
        }) || [];
        rows.push(...pageRows);
        if (pageRows.length < pageSize) break;
    }

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

const pruneStorage = async (allowedRemoteFiles) => {
    if (!shouldPrune) return;

    if (!allowedRemoteFiles.length) {
        console.warn('Skipped Storage pruning: the explicit upload manifest is empty.');
        return;
    }
    const keep = new Set(allowedRemoteFiles);

    // The bucket is dedicated to this site. Pruning from the root removes old
    // source JSON and every other object that is no longer in the explicit
    // reference-driven binary manifest.
    const remoteFiles = await listStorageObjects('');

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
    const uploadable = [...storageUploadManifest.values()]
        .sort((a, b) => a.remotePath.localeCompare(b.remotePath, 'en'));

    if (!uploadable.length) {
        console.warn('Skipped private file upload: no referenced binary assets were found.');
        return;
    }

    for (const [index, item] of uploadable.entries()) {
        const absoluteSource = path.resolve(root, item.localPath);
        const relativeSource = normalizeSlash(path.relative(root, absoluteSource));
        if (relativeSource.startsWith('../') || path.isAbsolute(relativeSource)) {
            throw new Error(`Storage source escaped the project root: ${item.localPath}`);
        }
        const info = await fs.stat(absoluteSource).catch(() => null);
        if (!info?.isFile()) {
            throw new Error(`Referenced Storage asset is missing: ${item.localPath}`);
        }
        const body = await fs.readFile(absoluteSource);

        await request(`/storage/v1/object/${bucket}/${item.remotePath}`, {
            method: 'POST',
            headers: {
                'Content-Type': contentTypeFor(item.localPath),
                'Cache-Control': '3600',
                'x-upsert': 'true'
            },
            body
        });

        console.log(`Uploaded private asset ${index + 1} / ${uploadable.length}: ${item.remotePath}`);
    }

    await pruneStorage(uploadable.map((item) => item.remotePath));
};

await validateDatabaseSchema();
await importRecords();
await importPeople();
await importRecordPages();
await importPageMessages();
await importPageSupplements();
await importMaterials();
await importQuiz();
await importCreditsPage();
await uploadPrivateFiles();

console.log(shouldPrune ? 'Migration complete. Remote stale data/files were pruned.' : 'Migration complete.');

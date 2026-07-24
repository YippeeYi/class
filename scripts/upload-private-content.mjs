#!/usr/bin/env node
/*
 * upload-private-content.mjs
 *
 * Migrates local secure content into Supabase.
 *
 * This version does NOT require:
 *   - private-assets/content/record/records_index.json
 *   - private-assets/content/people/people_index.json
 *
 * It imports structured rows by scanning:
 *   - private-assets/content/record/*.json
 *   - private-assets/content/people/*.json
 *   - private-assets/content/page-supplements/*.json
 *   - private-assets/content/materials/*.json
 *
 * Storage uploads are reference-driven. Only binary assets referenced by the
 * imported database rows are uploaded; source JSON is never copied to Storage.
 * Every local source lives below the ignored private-assets/ directory. Source
 * JSON is database-only; binary files are uploaded only when a database row
 * explicitly references them.
 *
 * PowerShell:
 *   $env:SUPABASE_URL="https://xxxx.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="your service_role key"
 *   $env:CLASS_RECORD_BUCKET="classrecord-private"
 *   node scripts/upload-private-content.mjs --dry-run
 *   node scripts/upload-private-content.mjs
 *   node scripts/upload-private-content.mjs --prune --confirm-prune
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contentRoot = 'private-assets/content';

const loadDotEnv = async () => {
    try {
        const text = await fs.readFile(path.join(root, '.env'), 'utf8');
        text.split(/\r?\n/).forEach((line) => {
            const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
            if (!match || match[1].startsWith('#') || process.env[match[1]]) return;
            process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
        });
    } catch {
        // .env is optional. CI and production should pass real environment variables.
    }
};

await loadDotEnv();

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.CLASS_RECORD_BUCKET || 'classrecord-private';
const argv = new Set(process.argv.slice(2));
const shouldPrune = argv.has('--prune');
const validateOnly = argv.has('--validate-only');
const dryRun = argv.has('--dry-run');
const confirmPrune = argv.has('--confirm-prune');
const concurrencyArg = process.argv.find((value) => value.startsWith('--concurrency='));
const uploadConcurrency = Math.min(8, Math.max(1, Number(concurrencyArg?.split('=')[1]) || 3));
const MAX_REQUEST_ATTEMPTS = 3;
const hiddenStoragePrefix = 'hidden/';
const allowedStorageRoots = ['data/attachments/', 'images/record-pages/', 'images/quiz/'];
const mealMapStoragePath = 'images/private/meal-map.png';
const protectedStorageObjects = new Set([mealMapStoragePath]);
const allowedStorageExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg',
    '.pdf', '.txt', '.zip', '.mp3', '.wav', '.ogg', '.mp4', '.webm'
]);
const storageUploadManifest = new Map();
const requiredDatabaseColumns = {
    class_quiz_questions: [
        'id', 'content_key', 'question_group', 'question_type', 'prompt',
        'choices', 'answer', 'explanation', 'image_path', 'sort_order', 'raw'
    ],
    class_private_assets: ['asset_key', 'width', 'height', 'updated_at']
};

if (!url || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

if (shouldPrune && !confirmPrune) {
    console.error('--prune requires --confirm-prune. No data was changed.');
    process.exit(1);
}

const baseUrl = url.replace(/\/$/, '');
const authHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
};

const normalizeSlash = (value) => String(value || '').replace(/\\/g, '/');

const request = async (endpoint, options = {}) => {
    let lastError;
    for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt += 1) {
        try {
            const response = await fetch(`${baseUrl}${endpoint}`, {
                ...options,
                headers: { ...authHeaders, ...(options.headers || {}) }
            });
            if (!response.ok) {
                const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
                if (!retryable || attempt === MAX_REQUEST_ATTEMPTS) {
                    throw new Error(`${options.method || 'GET'} request failed (HTTP ${response.status}).`);
                }
                lastError = new Error(`HTTP ${response.status}`);
            } else {
                if (response.status === 204) return null;
                const text = await response.text();
                return text ? JSON.parse(text) : null;
            }
        } catch (error) {
            lastError = error;
            if (attempt === MAX_REQUEST_ATTEMPTS) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
    }
    throw lastError || new Error('Network request failed.');
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
            + 'Run sql/setup.sql in Supabase SQL Editor, then retry this command.'
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
    if (storagePath.startsWith('images/record-pages/')) {
        return `private-assets/record-pages/${storagePath.slice('images/record-pages/'.length)}`;
    }
    if (storagePath.startsWith('data/attachments/')) {
        return `${contentRoot}/attachments/${storagePath.slice('data/attachments/'.length)}`;
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

    if (validateOnly || dryRun) {
        console.log(`Validated table write: ${table}, rows=${rows.length}, mode=${validateOnly ? 'validate-only' : 'dry-run'}`);
        return;
    }

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

    if (validateOnly || dryRun) {
        console.log(`Validated table prune: ${table}, keep=${keepValues.length}, mode=${validateOnly ? 'validate-only' : 'dry-run'}`);
        return;
    }

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
    const files = (await listJsonFiles(`${contentRoot}/record`, [
        `${contentRoot}/record/record_pages.json`
    ])).filter((file) => !parsePageSupplementFileName(file));

    if (!files.length) {
        console.warn(`Skipped records: no record JSON files found in ${contentRoot}/record/.`);
        return;
    }

    const rows = [];
    let visibleIndex = 0;
    let hiddenIndex = 0;

    for (const file of files) {
        const raw = await readJson(file);
        const fileName = relativeFromDir(`${contentRoot}/record`, file);

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
    const files = await listJsonFiles(`${contentRoot}/people`);

    if (!files.length) {
        console.warn(`Skipped people: no people JSON files found in ${contentRoot}/people/.`);
        return;
    }

    const rows = [];

    for (const [index, file] of files.entries()) {
        const raw = await readJson(file);
        const fileName = relativeFromDir(`${contentRoot}/people`, file);
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
    const files = (await listJsonFiles(`${contentRoot}/page-supplements`))
        .filter(parsePageSupplementFileName);

    if (!files.length) {
        console.warn(`Skipped page supplements: no page-number supplement JSON files found in ${contentRoot}/page-supplements/.`);
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
            file_name: relativeFromDir(`${contentRoot}/page-supplements`, file),
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
    const files = await listJsonFiles(`${contentRoot}/materials`);
    if (!files.length) {
        console.warn(`Skipped materials: no material JSON files found in ${contentRoot}/materials/.`);
        return;
    }

    const rows = [];
    for (const [index, file] of files.entries()) {
        const raw = await readJson(file);
        const fileName = relativeFromDir(`${contentRoot}/materials`, file);
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
    if (!(await exists(`${contentRoot}/record/record_pages.json`))) {
        console.warn(`Skipped record pages: ${contentRoot}/record/record_pages.json not found.`);
        return;
    }

    const rawPages = await readJson(`${contentRoot}/record/record_pages.json`);
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
    const files = await listJsonFiles(`${contentRoot}/messages`);
    if (!files.length) {
        console.warn(`Skipped page messages: no JSON files found in ${contentRoot}/messages/.`);
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
    if (!(await exists(`${contentRoot}/quiz/lamian.json`))) {
        console.warn(`Skipped quiz: ${contentRoot}/quiz/lamian.json not found.`);
        return;
    }

    const raw = await readJson(`${contentRoot}/quiz/lamian.json`);
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
    if (!(await exists(`${contentRoot}/credits-page.json`))) {
        console.warn(`Skipped credits page: ${contentRoot}/credits-page.json not found.`);
        return;
    }

    const raw = rewriteMarkupAssetsDeep(await readJson(`${contentRoot}/credits-page.json`));
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
    const keep = new Set([...allowedRemoteFiles, ...protectedStorageObjects]);

    const remoteFiles = await listStorageObjects();

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
    const uploadable = [...storageUploadManifest.values()].filter((item) => !item.uploaded)
        .sort((a, b) => a.remotePath.localeCompare(b.remotePath, 'en'));

    if (!uploadable.length) {
        console.warn('Skipped private file upload: no referenced binary assets were found.');
        await pruneStorage([...storageUploadManifest.values()].map((item) => item.remotePath));
        return;
    }

    const summary = { uploaded: 0, skipped: 0, failed: [] };
    let nextIndex = 0;
    const uploadOne = async (item) => {
        const absoluteSource = path.resolve(root, item.localPath);
        const relativeSource = normalizeSlash(path.relative(root, absoluteSource));
        if (!item.external && (relativeSource.startsWith('../') || path.isAbsolute(relativeSource))) {
            throw new Error(`Storage source escaped the project root: ${item.localPath}`);
        }
        const info = await fs.stat(absoluteSource).catch(() => null);
        if (!info?.isFile()) {
            throw new Error(`Referenced Storage asset is missing: ${item.localPath}`);
        }
        const body = await fs.readFile(absoluteSource);

        if (validateOnly || dryRun) {
            summary.skipped += 1;
            return;
        }
        await request(`/storage/v1/object/${bucket}/${item.remotePath}`, {
            method: 'POST',
            headers: {
                'Content-Type': contentTypeFor(item.localPath),
                'Cache-Control': '3600',
                'x-upsert': 'true'
            },
            body
        });
        item.uploaded = true;
        summary.uploaded += 1;
    };
    const worker = async () => {
        while (nextIndex < uploadable.length) {
            const index = nextIndex++;
            const item = uploadable[index];
            try {
                await uploadOne(item);
                console.log(`${dryRun || validateOnly ? 'Validated' : 'Uploaded'} private asset: ${index + 1} / ${uploadable.length}`);
            } catch (error) {
                summary.failed.push({ file: item.localPath, reason: error.message });
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(uploadConcurrency, uploadable.length) }, worker));
    if (summary.failed.length) {
        summary.failed.forEach(({ file, reason }) => console.error(`Failed private asset: ${file} (${reason})`));
        throw new Error(`Private asset upload failed for ${summary.failed.length} file(s).`);
    }
    console.log(`Private assets: uploaded=${summary.uploaded}, validated/skipped=${summary.skipped}, failed=0.`);

    await pruneStorage([...storageUploadManifest.values()].map((item) => item.remotePath));
};

const findMealMapSource = async () => {
    const directory = path.join(root, 'private-assets/meal-map');
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    // Read the directory once rather than probing two case variants. On
    // Windows both probes address the same file and would be a false duplicate.
    const files = entries
        .filter((entry) => entry.isFile() && /^map\.png$/i.test(entry.name))
        .map((entry) => path.join(directory, entry.name));
    if (!files.length) throw new Error('Missing private-assets/meal-map/map.png. No map upload was attempted.');
    if (files.length > 1) throw new Error('Found both map.png and map.PNG in private-assets/meal-map. Keep exactly one source file.');
    return files[0];
};

const uploadMealMap = async () => {
    const source = await findMealMapSource();
    const body = await fs.readFile(source);
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (body.length < 24 || !body.subarray(0, 8).equals(signature)) {
        throw new Error('map.png is not a valid PNG file. No map upload was attempted.');
    }
    const width = body.readUInt32BE(16);
    const height = body.readUInt32BE(20);
    if (!width || !height) throw new Error('map.png has invalid dimensions. No map upload was attempted.');
    if (!validateOnly && !dryRun) {
        await request(`/storage/v1/object/${bucket}/${mealMapStoragePath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=180', 'x-upsert': 'true' },
            body
        });
        await request('/rest/v1/class_private_assets?on_conflict=asset_key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify([{ asset_key: 'meal-map', width, height, updated_at: new Date().toISOString() }])
        });
    }
    console.log(`${validateOnly ? 'Validated' : dryRun ? 'Would upload' : 'Uploaded'} meal map (${width}×${height}, image/png).`);
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
await uploadMealMap();

console.log(shouldPrune ? 'Upload complete. Remote stale data/files were pruned.' : 'Upload complete.');

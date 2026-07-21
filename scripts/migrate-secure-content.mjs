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
const argv = new Set(process.argv.slice(2));
const shouldPrune = argv.has('--prune');
const validateOnly = argv.has('--validate-only');
const dryRun = argv.has('--dry-run');
const confirmPrune = argv.has('--confirm-prune');
const admissionsDataDir = String(process.env.ADMISSIONS_DATA_DIR || '').trim();
const hiddenStoragePrefix = 'hidden/';
const allowedStorageRoots = ['data/attachments/', 'images/record-pages/', 'images/quiz/', 'images/admissions/'];
const allowedStorageExtensions = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg',
    '.pdf', '.txt', '.zip', '.mp3', '.wav', '.ogg', '.mp4', '.webm'
]);
const storageUploadManifest = new Map();
const admissionsRemoteFiles = new Set();
const requiredDatabaseColumns = {
    class_quiz_questions: [
        'id', 'content_key', 'question_group', 'question_type', 'prompt',
        'choices', 'answer', 'explanation', 'image_path', 'sort_order', 'raw'
    ]
};

const admissionsRequiredColumns = {
    class_universities: ['id', 'name', 'province_code', 'province_name', 'city_name', 'longitude', 'latitude', 'logo_path'],
    class_admissions: ['id', 'person_id', 'university_id', 'display_name_override', 'major']
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

    const specificationByTable = { ...requiredDatabaseColumns, ...(admissionsDataDir ? admissionsRequiredColumns : {}) };
    for (const [table, requiredColumns] of Object.entries(specificationByTable)) {
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

const admissionsLog = (label, fields = {}) => {
    // Never include student display names, majors, bearer tokens, or signed URLs.
    console.log(label, Object.entries(fields).map(([key, value]) => `${key}=${String(value)}`).join(' '));
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

const readExternalJson = async (fileName) => {
    const directory = path.resolve(admissionsDataDir);
    const absolute = path.resolve(directory, fileName);
    if (!admissionsDataDir || !absolute.startsWith(`${directory}${path.sep}`)) {
        throw new Error(`Invalid admissions data path: ${fileName}`);
    }
    return JSON.parse(await fs.readFile(absolute, 'utf8'));
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

const admissionsStoragePath = (id, sourceFile) => {
    const extension = path.extname(String(sourceFile || '')).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(extension)) {
        throw new Error(`Admissions logo has an unsupported extension for university ID ${id}`);
    }
    return `images/admissions/${id}${extension === '.jpg' ? '.jpeg' : extension}`;
};

const validateAdmissionsLogo = async (id, logoFile) => {
    const absoluteDirectory = path.resolve(admissionsDataDir);
    const absolute = path.resolve(absoluteDirectory, String(logoFile || ''));
    if (!absolute.startsWith(`${absoluteDirectory}${path.sep}`)) throw new Error(`Admissions logo escaped ADMISSIONS_DATA_DIR for university ID ${id}`);
    const info = await fs.stat(absolute).catch(() => null);
    if (!info?.isFile()) throw new Error(`Admissions logo file is missing for university ID ${id}`);
    if (info.size > 2 * 1024 * 1024) throw new Error(`Admissions logo is larger than 2 MiB for university ID ${id}`);
    const extension = path.extname(absolute).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(extension)) throw new Error(`Admissions logo has an unsupported type for university ID ${id}`);
    if (extension === '.svg') {
        const contents = await fs.readFile(absolute, 'utf8');
        if (/<(?:script|foreignObject)\b|\bon[a-z]+\s*=|(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|javascript:)/i.test(contents)) {
            throw new Error(`Admissions SVG is unsafe for university ID ${id}`);
        }
    }
    const bytes = await fs.readFile(absolute);
    const looksLikePng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const looksLikeJpeg = bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    const looksLikeWebp = bytes.subarray(0, 12).toString('ascii', 0, 4) === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
    if ((extension === '.png' && !looksLikePng) || ((extension === '.jpg' || extension === '.jpeg') && !looksLikeJpeg) || (extension === '.webp' && !looksLikeWebp)) {
        throw new Error(`Admissions logo MIME signature does not match its extension for university ID ${id}`);
    }
    return { absolute, extension };
};

const loadMapProvinceCodes = async () => {
    const mapPath = path.join(root, 'maps', 'china-provinces.geojson');
    const map = JSON.parse(await fs.readFile(mapPath, 'utf8').catch(() => {
        throw new Error('Missing maps/china-provinces.geojson. Install a reviewed, authoritative GeoJSON before importing admissions.');
    }));
    if (map?.type !== 'FeatureCollection' || !Array.isArray(map.features)) throw new Error('Map GeoJSON must be a FeatureCollection.');
    const codes = new Set(map.features.map((feature) => String(feature?.properties?.adcode || '')).filter((value) => /^\d{6}$/.test(value)));
    if (!codes.size) throw new Error('Map GeoJSON contains no six-digit properties.adcode values.');
    return codes;
};

const importAdmissions = async () => {
    if (!admissionsDataDir) return;
    const dataDirectory = path.resolve(admissionsDataDir);
    const directoryInfo = await fs.stat(dataDirectory).catch(() => null);
    if (!directoryInfo?.isDirectory()) throw new Error('ADMISSIONS_DATA_DIR does not exist or is not a directory.');
    const [universityDocument, admissionsDocument, mapCodes] = await Promise.all([
        readExternalJson('universities.json'), readExternalJson('admissions.json'), loadMapProvinceCodes()
    ]);
    const universities = Array.isArray(universityDocument) ? universityDocument : universityDocument?.universities;
    const admissions = Array.isArray(admissionsDocument) ? admissionsDocument : admissionsDocument?.admissions;
    if (!Array.isArray(universities) || !universities.length) throw new Error('universities.json must contain a non-empty universities array.');
    if (!Array.isArray(admissions) || !admissions.length) throw new Error('admissions.json must contain a non-empty admissions array. Refusing to import or prune.');

    const universityRows = [];
    const universityIds = new Set();
    for (const source of universities) {
        const id = String(source?.id || '').trim();
        const provinceCode = String(source?.provinceCode || source?.province_code || '').trim();
        const longitude = Number(source?.longitude);
        const latitude = Number(source?.latitude);
        if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(id)) throw new Error('University ID must be lowercase ASCII slug.');
        if (universityIds.has(id)) throw new Error(`Duplicate university ID: ${id}`);
        universityIds.add(id);
        if (!mapCodes.has(provinceCode)) throw new Error(`University province code does not match map data: ${provinceCode}`);
        if (!String(source?.name || '').trim() || !String(source?.provinceName || source?.province_name || '').trim() || !String(source?.cityName || source?.city_name || '').trim()) throw new Error(`University required location field is missing for ID ${id}`);
        if (!Number.isFinite(longitude) || longitude < 73 || longitude > 136 || !Number.isFinite(latitude) || latitude < 3 || latitude > 54) throw new Error(`University coordinates are invalid for ID ${id}`);
        let logoPath = null;
        if (source?.logo) {
            const checked = await validateAdmissionsLogo(id, source.logo);
            logoPath = admissionsStoragePath(id, source.logo);
            admissionsRemoteFiles.add(logoPath);
            storageUploadManifest.set(logoPath, { localPath: checked.absolute, remotePath: logoPath, external: true });
        }
        universityRows.push({
            id, name: String(source.name).trim(), short_name: String(source.shortName || source.short_name || '').trim() || null,
            province_code: provinceCode, province_name: String(source.provinceName || source.province_name).trim(),
            city_name: String(source.cityName || source.city_name).trim(), campus: String(source.campus || '').trim() || null,
            longitude, latitude, logo_path: logoPath, display_order: Number.isFinite(Number(source.displayOrder)) ? Number(source.displayOrder) : 0
        });
    }
    const personIds = new Set();
    const admissionRows = admissions.map((source, index) => {
        const personId = String(source?.personId || source?.person_id || '').trim();
        const universityId = String(source?.universityId || source?.university_id || '').trim();
        if (!personId || !universityId || !universityIds.has(universityId)) throw new Error(`Admission record ${index + 1} has an unknown person or university ID.`);
        if (personIds.has(personId)) throw new Error(`Duplicate final admission person ID: ${personId}`);
        personIds.add(personId);
        return { person_id: personId, university_id: universityId, display_name_override: String(source.displayNameOverride || source.display_name_override || '').trim() || null, major: String(source.major || '').trim() || null, display_order: Number.isFinite(Number(source.displayOrder)) ? Number(source.displayOrder) : 0 };
    });
    // Validate references without exposing names. Service-role access is used only in this local script.
    const people = await request(`/rest/v1/class_people?select=id&id=in.${encodeURIComponent(quoteList([...personIds]))}`);
    const found = new Set((people || []).map((row) => String(row.id)));
    const missing = [...personIds].filter((id) => !found.has(id));
    if (missing.length) throw new Error(`Admissions reference ${missing.length} person IDs that do not exist in class_people.`);
    admissionsLog('Validated admissions import', { universities: universityRows.length, admissions: admissionRows.length, logos: admissionsRemoteFiles.size });
    // Store logos before their database references are visible. If this step
    // fails, no admission/university rows are written. Existing orphaned logos
    // are safely handled by the explicit prune pass.
    await uploadAdmissionsAssets();
    await upsert('class_universities', universityRows, 'id');
    await upsert('class_admissions', admissionRows, 'person_id');
    if (shouldPrune) {
        if (!confirmPrune) throw new Error('--prune requires --confirm-prune. No deletion was performed.');
        await pruneTable('class_admissions', 'person_id', [...personIds]);
        // Universities referenced by historical admissions are protected by FK; remove only unreferenced rows via a server-side safe condition.
        if (!validateOnly && !dryRun) {
            const referenced = await request('/rest/v1/class_admissions?select=university_id');
            const protectedIds = new Set((referenced || []).map((row) => String(row.university_id)));
            const allUniversities = await request('/rest/v1/class_universities?select=id');
            const deletable = (allUniversities || []).map((row) => String(row.id)).filter((id) => !universityIds.has(id) && !protectedIds.has(id));
            if (deletable.length) await request(`/rest/v1/class_universities?id=in.${encodeURIComponent(quoteList(deletable))}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
            admissionsLog('Pruned unreferenced universities', { deleted: deletable.length, retained: protectedIds.size });
        }
    }
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
        admissionsLog('Validated table write', { table, rows: rows.length, mode: validateOnly ? 'validate-only' : 'dry-run' });
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
        admissionsLog('Validated table prune', { table, keep: keepValues.length, mode: validateOnly ? 'validate-only' : 'dry-run' });
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

    // Admissions imports may be run without the rest of the site's private
    // source tree. In that mode prune only its own prefix; it must never turn
    // a missing unrelated source directory into a bucket-wide deletion.
    const prunePrefix = admissionsDataDir ? 'images/admissions' : '';
    const remoteFiles = await listStorageObjects(prunePrefix);

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

    for (const [index, item] of uploadable.entries()) {
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
        admissionsLog('Uploaded private asset', { current: index + 1, total: uploadable.length, file: path.basename(item.remotePath) });
    }

    await pruneStorage([...storageUploadManifest.values()].map((item) => item.remotePath));
};

const uploadAdmissionsAssets = async () => {
    const candidates = [...storageUploadManifest.values()].filter((item) => item.external && !item.uploaded);
    if (!candidates.length || validateOnly || dryRun) return;
    for (const [index, item] of candidates.entries()) {
        const info = await fs.stat(item.localPath).catch(() => null);
        if (!info?.isFile()) throw new Error('Validated admissions logo disappeared before upload.');
        await request(`/storage/v1/object/${bucket}/${item.remotePath}`, {
            method: 'POST',
            headers: { 'Content-Type': contentTypeFor(item.localPath), 'Cache-Control': '300', 'x-upsert': 'true' },
            body: await fs.readFile(item.localPath)
        });
        item.uploaded = true;
        admissionsLog('Uploaded admissions logo', { current: index + 1, total: candidates.length, file: path.basename(item.remotePath) });
    }
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
await importAdmissions();
await uploadPrivateFiles();

console.log(shouldPrune ? 'Migration complete. Remote stale data/files were pruned.' : 'Migration complete.');

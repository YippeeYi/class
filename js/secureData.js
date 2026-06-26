(function () {
    const CONFIG_URL = 'supabaseConfig.js';
    const SUPABASE_SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    const DEFAULT_BUCKET = 'classrecord-private';

    let configPromise = null;
    let clientPromise = null;
    const signedUrlCache = new Map();
    const failedSignCache = new Map();
    const listCache = new Map();
    const FAILED_SIGN_TTL = 5 * 60 * 1000;

    const loadScriptOnce = (src) => new Promise((resolve, reject) => {
        if ([...document.scripts].some((script) => script.src === src)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Script load failed: ${src}`));
        document.head.appendChild(script);
    });

    const loadConfig = async () => {
        if (window.CLASS_RECORD_SUPABASE) return window.CLASS_RECORD_SUPABASE;
        if (!configPromise) {
            configPromise = loadScriptOnce(CONFIG_URL).then(() => window.CLASS_RECORD_SUPABASE || {});
        }
        return configPromise;
    };

    const getConfig = async () => {
        const config = await loadConfig();
        return {
            url: config.url || '',
            anonKey: config.anonKey || '',
            bucket: config.bucket || config.storage?.privateBucket || DEFAULT_BUCKET,
            tables: {
                records: 'class_records',
                people: 'class_people',
                glossary: 'class_glossary',
                recordPages: 'class_record_pages',
                quizQuestions: 'class_quiz_questions',
                ...(config.tables || {})
            }
        };
    };

    const isEnabled = () => {
        const config = window.CLASS_RECORD_SUPABASE || {};
        return Boolean(config.url && config.anonKey);
    };

    const getClient = async () => {
        const config = await getConfig();
        if (!config.url || !config.anonKey) throw new Error('Supabase is not configured.');
        if (!clientPromise) {
            clientPromise = loadScriptOnce(SUPABASE_SDK_URL).then(() => {
                if (!window.supabase?.createClient) throw new Error('Supabase SDK is unavailable.');
                return window.supabase.createClient(config.url, config.anonKey, {
                    auth: { persistSession: true, autoRefreshToken: true }
                });
            });
        }
        return clientPromise;
    };

    const selectAll = async (tableName, columns = '*', order, filters = {}) => {
        const config = await getConfig();
        const client = await getClient();
        let query = client.from(tableName).select(columns);
        Object.entries(filters || {}).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
        if (order) query = query.order(order, { ascending: true });
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    };

    const parseRaw = (row) => {
        if (!row?.raw) return {};
        if (typeof row.raw === 'string') {
            try { return JSON.parse(row.raw); } catch (error) { return {}; }
        }
        return row.raw && typeof row.raw === 'object' ? row.raw : {};
    };

    const truthyHidden = (value) => value === true || String(value || '').trim().toLowerCase() === 'true';

    const normalizePrivateStoragePath = (path) => {
        const config = window.CLASS_RECORD_SUPABASE || {};
        const bucket = config.bucket || config.storage?.privateBucket || DEFAULT_BUCKET;
        const raw = String(path || '').trim().replace(/^\/+/, '');
        if (!raw || /^https?:\/\//i.test(raw)) return raw;
        return raw
            .replace(new RegExp(`^${bucket.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`, 'i'), '')
            .replace(/^storage\/v1\/object\/sign\/[^/]+\//i, '')
            .replace(/^storage\/v1\/object\/public\/[^/]+\//i, '');
    };

    const normalizeRecordPageImagePath = (value, page) => {
        const raw = String(value || '').trim();
        if (/^https?:\/\//i.test(raw)) return raw.replace(/\.jpg(\?|#|$)/i, '.jpeg$1');
        const source = raw || (page ? `record-page-${page}` : '');
        if (!source) return '';
        const clean = source.replace(/^\/?/, '').replace(/^images\/record-pages\//i, '').replace(/^record-pages\//i, '');
        const base = clean.replace(/\.(png|jpe?g|webp|gif)$/i, '');
        return `images/record-pages/${base}.jpeg`;
    };

    const normalizeRecord = (row, fallbackIndex = 0) => {
        const raw = parseRaw(row);
        const fileName = row.file_name || raw.fileName || raw.id || `record-${fallbackIndex + 1}`;
        const text = row.content || raw.text || raw.content || '';
        const attachments = Array.isArray(row.attachments) ? row.attachments : (Array.isArray(raw.attachments) ? raw.attachments : []);
        const recordIndex = Number(row.record_index ?? raw.recordIndex ?? fallbackIndex + 1);
        return {
            ...raw,
            fileName,
            id: row.record_id || raw.id || fileName,
            recordIndex,
            date: row.record_date || raw.date || '',
            time: row.record_time || raw.time || '',
            recorder: row.author || raw.recorder || raw.author || '',
            author: row.author || raw.author || raw.recorder || '',
            text,
            content: text,
            importance: row.importance || raw.importance || '',
            attachments,
            hidden: truthyHidden(row.hidden ?? raw.hidden),
            imagePath: normalizeRecordPageImagePath(row.image_path || raw.imagePath || raw.image || raw.pageImage || '', row.page || raw.page),
            source: 'supabase'
        };
    };

    const loadRecords = async ({ onProgressStep, hidden = false } = {}) => {
        const config = await getConfig();
        const rows = await selectAll(
            config.tables.records,
            '*',
            'record_index',
            { hidden: Boolean(hidden) }
        );
        return rows.map((row, index) => {
            const record = normalizeRecord(row, index);
            if (typeof onProgressStep === 'function') onProgressStep(record.fileName);
            return record;
        });
    };

    const loadPeople = async ({ onProgressStep } = {}) => {
        const config = await getConfig();
        const rows = await selectAll(config.tables.people, '*', 'id');
        return rows.map((row, index) => {
            const raw = parseRaw(row);
            const item = {
                ...raw,
                id: row.person_id || raw.id || raw.name || `person-${index + 1}`,
                name: row.name || raw.name || '',
                aliases: Array.isArray(row.aliases) ? row.aliases : (Array.isArray(raw.aliases) ? raw.aliases : []),
                bio: row.bio || raw.bio || '',
                avatarUrl: row.avatar_url || raw.avatarUrl || raw.avatar || '',
                claimedBy: row.claimed_by || raw.claimedBy || raw.claimed_by || '',
                claimedAt: row.claimed_at || raw.claimedAt || raw.claimed_at || '',
                source: 'supabase'
            };
            if (typeof onProgressStep === 'function') onProgressStep(item.id);
            return item;
        });
    };

    const loadGlossary = async ({ onProgressStep } = {}) => {
        const config = await getConfig();
        const rows = await selectAll(config.tables.glossary, '*', 'id');
        return rows.map((row, index) => {
            const raw = parseRaw(row);
            const item = {
                ...raw,
                id: row.term_id || raw.id || raw.term || `term-${index + 1}`,
                term: row.term || raw.term || '',
                aliases: Array.isArray(row.aliases) ? row.aliases : (Array.isArray(raw.aliases) ? raw.aliases : []),
                definition: row.definition || raw.definition || raw.description || '',
                source: 'supabase'
            };
            if (typeof onProgressStep === 'function') onProgressStep(item.id);
            return item;
        });
    };

    const loadRecordPages = async ({ hidden = false } = {}) => {
        const config = await getConfig();
        const rows = await selectAll(config.tables.recordPages, '*', 'sort_order', { hidden: Boolean(hidden) });
        return rows.map((row, index) => {
            const raw = parseRaw(row);
            const page = Number(row.page ?? raw.page ?? index + 1);
            return {
                ...raw,
                page,
                startFile: row.start_file || raw.startFile || raw.start || '',
                endFile: row.end_file || raw.endFile || raw.end || '',
                imagePath: normalizeRecordPageImagePath(row.image_path || raw.imagePath || raw.image || '', page),
                hidden: truthyHidden(row.hidden ?? raw.hidden)
            };
        });
    };

    const loadQuizQuestions = async (contentKey) => {
        const config = await getConfig();
        const rows = (await selectAll(config.tables.quizQuestions, '*', 'sort_order')).filter((row) => (row.content_key || row.question_group || parseRaw(row).content || parseRaw(row).group) === contentKey);
        return rows.map((row, index) => {
            const raw = parseRaw(row);
            return {
                ...raw,
                id: raw.id || `${contentKey}-${index + 1}`,
                type: row.question_type || raw.type || 'choice',
                prompt: row.prompt || raw.prompt || '',
                choices: Array.isArray(row.choices) ? row.choices : (Array.isArray(raw.choices) ? raw.choices : []),
                answer: row.answer || raw.answer || '',
                explanation: row.explanation || raw.explanation || '',
                image: normalizePrivateStoragePath(row.image_path || raw.image || raw.imagePath || '')
            };
        });
    };

    const signAssetUrl = async (path, { expiresIn, quiet = false } = {}) => {
        const safePath = normalizePrivateStoragePath(path);
        if (!safePath || /^https?:\/\//i.test(safePath)) return safePath;
        const now = Date.now();
        const failedAt = failedSignCache.get(safePath);
        if (failedAt && now - failedAt < FAILED_SIGN_TTL) {
            if (quiet) return '';
            throw new Error(`Storage asset unavailable: ${safePath}`);
        }
        if (signedUrlCache.has(safePath)) return signedUrlCache.get(safePath);
        const config = await getConfig();
        const client = await getClient();
        const promise = client.storage.from(config.bucket).createSignedUrl(safePath, expiresIn || 60 * 30)
            .then(({ data, error }) => {
                if (error) throw error;
                return data?.signedUrl || '';
            })
            .catch((error) => {
                signedUrlCache.delete(safePath);
                failedSignCache.set(safePath, Date.now());
                if (quiet) return '';
                throw error;
            });
        signedUrlCache.set(safePath, promise);
        return promise;
    };

    const signAssetUrls = async (paths, options) => {
        const unique = [...new Set((paths || []).filter(Boolean))];
        const settled = await Promise.allSettled(unique.map(async (path) => [path, await signAssetUrl(path, options)]));
        const entries = settled
            .filter((result) => result.status === 'fulfilled')
            .map((result) => result.value)
            .filter(([, url]) => Boolean(url));
        return new Map(entries);
    };

    const uploadAssetFile = async (path, file, { contentType, upsert = true } = {}) => {
        const safePath = normalizePrivateStoragePath(path);
        if (!safePath || !file) throw new Error('Storage upload path and file are required.');
        const config = await getConfig();
        const client = await getClient();
        const { data, error } = await client.storage.from(config.bucket).upload(safePath, file, {
            cacheControl: '3600',
            contentType: contentType || file.type || 'application/octet-stream',
            upsert
        });
        if (error) throw error;
        signedUrlCache.delete(safePath);
        failedSignCache.delete(safePath);
        const folder = safePath.split('/').slice(0, -1).join('/');
        if (folder) listCache.delete(folder);
        return data?.path || safePath;
    };

    const listAssetPaths = async (prefix = '') => {
        const safePrefix = normalizePrivateStoragePath(prefix).replace(/\/+$/, '');
        if (listCache.has(safePrefix)) return listCache.get(safePrefix);
        const config = await getConfig();
        const client = await getClient();
        const promise = client.storage.from(config.bucket).list(safePrefix, {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' }
        }).then(({ data, error }) => {
            if (error) throw error;
            return (data || [])
                .filter((item) => item && item.name && !item.name.endsWith('/'))
                .map((item) => `${safePrefix}/${item.name}`.replace(/^\/+/, ''));
        }).catch((error) => {
            listCache.delete(safePrefix);
            throw error;
        });
        listCache.set(safePrefix, promise);
        return promise;
    };
    const resolveAssetElements = async (root = document) => {
        const imageNodes = [...root.querySelectorAll('img[data-secure-src]')];
        const linkNodes = [...root.querySelectorAll('a[data-secure-href]')];
        const paths = [
            ...imageNodes.map((node) => node.getAttribute('data-secure-src')),
            ...linkNodes.map((node) => node.getAttribute('data-secure-href'))
        ].filter(Boolean);
        const signed = await signAssetUrls(paths).catch((error) => {
            console.warn('Secure asset signing failed:', error);
            return new Map();
        });
        imageNodes.forEach((node) => {
            const src = signed.get(node.getAttribute('data-secure-src'));
            if (src) node.src = src;
        });
        linkNodes.forEach((node) => {
            const href = signed.get(node.getAttribute('data-secure-href'));
            if (href) node.href = href;
        });
    };

    const bindSecureImages = resolveAssetElements;

    window.ClassRecordData = {
        bindSecureImages,
        resolveAssetElements,
        getClient,
        getConfig,
        isEnabled,
        loadGlossary,
        loadPeople,
        loadQuizQuestions,
        loadRecordPages,
        loadRecords,
        normalizePrivateStoragePath,
        normalizeRecordPageImagePath,
        signAssetUrl,
        signAssetUrls,
        uploadAssetFile,
        listAssetPaths
    };
})();

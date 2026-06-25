(function () {
    const CONFIG_URL = 'supabaseConfig.js';
    const SUPABASE_SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    const DEFAULT_BUCKET = 'classrecord-private';

    let configPromise = null;
    let clientPromise = null;

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
        if (window.SUPABASE_CONFIG) return window.SUPABASE_CONFIG;
        if (!configPromise) {
            configPromise = loadScriptOnce(CONFIG_URL).then(() => window.SUPABASE_CONFIG || {});
        }
        return configPromise;
    };

    const getConfig = async () => {
        const config = await loadConfig();
        return {
            url: config.url || '',
            anonKey: config.anonKey || '',
            bucket: config.bucket || DEFAULT_BUCKET,
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

    const isEnabled = () => Boolean(window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey);

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
            hidden: Boolean(row.hidden ?? raw.hidden),
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
                hidden: Boolean(row.hidden ?? raw.hidden)
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
                image: row.image_path || raw.image || raw.imagePath || ''
            };
        });
    };

    const signAssetUrl = async (path, { expiresIn } = {}) => {
        const safePath = String(path || '').replace(/^\/+/, '');
        if (!safePath || /^https?:\/\//i.test(safePath)) return safePath;
        const config = await getConfig();
        const client = await getClient();
        const { data, error } = await client.storage.from(config.bucket).createSignedUrl(safePath, expiresIn || 60 * 30);
        if (error) throw error;
        return data?.signedUrl || '';
    };

    const signAssetUrls = async (paths, options) => {
        const unique = [...new Set((paths || []).filter(Boolean))];
        const entries = await Promise.all(unique.map(async (path) => [path, await signAssetUrl(path, options)]));
        return new Map(entries);
    };

    const bindSecureImages = async (root = document) => {
        const nodes = [...root.querySelectorAll('img[data-secure-src]')];
        const paths = nodes.map((node) => node.getAttribute('data-secure-src')).filter(Boolean);
        const signed = await signAssetUrls(paths).catch((error) => {
            console.warn('Secure image signing failed:', error);
            return new Map();
        });
        nodes.forEach((node) => {
            const path = node.getAttribute('data-secure-src');
            const src = signed.get(path);
            if (src) node.src = src;
        });
    };

    window.ClassRecordData = {
        bindSecureImages,
        getClient,
        getConfig,
        isEnabled,
        loadGlossary,
        loadPeople,
        loadQuizQuestions,
        loadRecordPages,
        loadRecords,
        normalizeRecordPageImagePath,
        signAssetUrl,
        signAssetUrls
    };
})();
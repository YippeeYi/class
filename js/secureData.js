/************************************************************
 * secureData.js
 * 登录后从 Supabase RLS 表与私有 Storage 读取敏感内容
 ************************************************************/

(() => {
    const signedUrlCache = new Map();
    const inflightSignedUrls = new Map();

    const normalizeAssetPath = (path) => String(path || '')
        .trim()
        .replace(/^\.\//, '')
        .replace(/^\//, '');

    const isRemoteUrl = (value) => /^https?:\/\//i.test(String(value || ''));

    const getConfig = () => window.ClassRecordSupabase?.getConfig?.() || window.CLASS_RECORD_SUPABASE || {};

    const isEnabled = () => getConfig().useSecureContent !== false;

    const getClient = async () => window.ClassRecordSupabase.getClient();

    const table = (name) => getConfig().tables?.[name] || name;

    const storageConfig = () => ({
        privateBucket: 'classrecord-private',
        signedUrlExpiresIn: 600,
        ...(getConfig().storage || {})
    });

    const touchProgress = (count, onProgressStep) => {
        if (typeof onProgressStep !== 'function') return;
        for (let i = 0; i < count; i += 1) {
            onProgressStep();
        }
    };

    const selectAll = async (tableName, columns, order) => {
        const client = await getClient();
        const pageSize = 1000;
        const rows = [];
        for (let from = 0; ; from += pageSize) {
            let query = client.from(tableName).select(columns).range(from, from + pageSize - 1);
            if (order?.column) {
                query = query.order(order.column, { ascending: order.ascending !== false });
            }
            const { data, error } = await query;
            if (error) throw error;
            rows.push(...(data || []));
            if (!data || data.length < pageSize) break;
        }
        return rows;
    };

    const normalizeRecord = (row, index) => {
        const raw = row.raw && typeof row.raw === 'object' ? row.raw : {};
        const fileName = row.file_name || raw.fileName || raw.file_name || '';
        const date = row.record_date || raw.date || String(fileName).slice(0, 10);
        const record = {
            ...raw,
            id: row.record_id || raw.id || `R${String(index + 1).padStart(3, '0')}`,
            fileName,
            recordIndex: Number.isInteger(row.record_index) ? row.record_index : index,
            date,
            author: row.author || raw.author || '',
            content: row.content ?? raw.content ?? '',
            importance: row.importance || raw.importance || 'normal',
            attachments: Array.isArray(row.attachments) ? row.attachments : (Array.isArray(raw.attachments) ? raw.attachments : [])
        };
        if (row.record_time || raw.time) {
            record.time = row.record_time || raw.time;
        } else {
            delete record.time;
        }
        return record;
    };

    const loadRecords = async ({ onProgressStep } = {}) => {
        const rows = await selectAll(
            table('records'),
            'file_name,record_id,record_date,record_time,author,content,importance,attachments,record_index,raw',
            { column: 'record_index', ascending: true }
        );
        touchProgress(rows.length, onProgressStep);
        return rows.map(normalizeRecord);
    };

    const loadPeople = async ({ onProgressStep } = {}) => {
        const rows = await selectAll(
            table('people'),
            'id,alias,role,bio,sort_order,raw',
            { column: 'sort_order', ascending: true }
        );
        touchProgress(rows.length, onProgressStep);
        return rows.map((row) => ({
            ...(row.raw && typeof row.raw === 'object' ? row.raw : {}),
            id: row.id,
            alias: row.alias || '',
            role: row.role || 'student',
            bio: row.bio || ''
        }));
    };

    const loadGlossary = async ({ onProgressStep } = {}) => {
        const rows = await selectAll(
            table('glossary'),
            'id,label,definition,sort_order,raw',
            { column: 'sort_order', ascending: true }
        );
        touchProgress(rows.length, onProgressStep);
        return rows.map((row) => ({
            ...(row.raw && typeof row.raw === 'object' ? row.raw : {}),
            id: row.id,
            label: row.label || row.raw?.label || row.id,
            definition: row.definition || row.raw?.definition || ''
        }));
    };

    const loadRecordPages = async () => {
        const rows = await selectAll(
            table('recordPages'),
            'page,start_file,end_file,sort_order,raw',
            { column: 'sort_order', ascending: true }
        );
        return rows.map((row) => ({
            ...(row.raw && typeof row.raw === 'object' ? row.raw : {}),
            page: row.page,
            start: row.start_file || row.raw?.start || '',
            end: row.end_file || row.raw?.end || ''
        }));
    };

    const loadQuizQuestions = async (group) => {
        const client = await getClient();
        const { data, error } = await client
            .from(table('quizQuestions'))
            .select('id,question_group,prompt,answer,image_path,sort_order,raw')
            .eq('question_group', group)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return (data || []).map((row) => ({
            ...(row.raw && typeof row.raw === 'object' ? row.raw : {}),
            id: row.id,
            prompt: row.prompt || row.raw?.prompt || '',
            answer: row.answer || row.raw?.answer || '',
            image: row.image_path || row.raw?.image || ''
        }));
    };

    const signAssetUrl = async (path, { expiresIn } = {}) => {
        const normalized = normalizeAssetPath(path);
        if (!normalized || isRemoteUrl(normalized)) return normalized;

        const cached = signedUrlCache.get(normalized);
        const now = Date.now();
        if (cached && cached.expiresAt - now > 30 * 1000) {
            return cached.url;
        }
        if (inflightSignedUrls.has(normalized)) {
            return inflightSignedUrls.get(normalized);
        }

        const promise = (async () => {
            const client = await getClient();
            const storage = storageConfig();
            const ttl = Number(expiresIn || storage.signedUrlExpiresIn) || 600;
            const { data, error } = await client.storage
                .from(storage.privateBucket)
                .createSignedUrl(normalized, ttl);
            if (error) throw error;
            signedUrlCache.set(normalized, {
                url: data.signedUrl,
                expiresAt: Date.now() + ttl * 1000
            });
            return data.signedUrl;
        })();

        inflightSignedUrls.set(normalized, promise);
        try {
            return await promise;
        } finally {
            inflightSignedUrls.delete(normalized);
        }
    };

    const signAssetUrls = async (paths, options) => {
        const unique = Array.from(new Set(paths.map(normalizeAssetPath).filter(Boolean)));
        const entries = await Promise.all(unique.map(async (path) => [path, await signAssetUrl(path, options)]));
        return new Map(entries);
    };

    const resolveAssetElements = async (root = document) => {
        const elements = Array.from(root.querySelectorAll('[data-secure-src], [data-secure-href]'));
        if (!elements.length || !isEnabled()) return;
        const paths = elements.flatMap((el) => [el.dataset.secureSrc, el.dataset.secureHref]).filter(Boolean);
        const signed = await signAssetUrls(paths).catch((error) => {
            console.warn('私有资源签名失败：', error);
            return new Map();
        });
        elements.forEach((el) => {
            const src = normalizeAssetPath(el.dataset.secureSrc);
            const href = normalizeAssetPath(el.dataset.secureHref);
            if (src && signed.get(src)) el.src = signed.get(src);
            if (href && signed.get(href)) el.href = signed.get(href);
        });
    };

    window.ClassRecordData = {
        isEnabled,
        loadGlossary,
        loadPeople,
        loadQuizQuestions,
        loadRecordPages,
        loadRecords,
        normalizeAssetPath,
        resolveAssetElements,
        signAssetUrl,
        signAssetUrls
    };
})();

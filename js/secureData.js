(function () {
    const CONFIG_URL = 'supabaseConfig.js';
    const SUPABASE_SDK_URL = 'vendor/supabase-js-2.45.0.js';
    const SUPABASE_SDK_INTEGRITY = 'sha384-NNePyabYRaJyedI6EQAY7SV5Z8/0sQkuQ5WVfhKm0H+j0KSugkI2ZMNzw/QtzAWz';
    const DEFAULT_BUCKET = 'classrecord-private';

    let configPromise = null;
    let clientPromise = null;
    const recordPromises = new Map();
    let peoplePromise = null;
    const recordPagePromises = new Map();
    const pageSupplementPromises = new Map();
    let pageMessagesPromise = null;
    let creditsPagePromise = null;
    let materialsPromise = null;
    let quizQuestionsPromise = null;
    let adminQuizPreloadPromise = null;
    const assetListPromises = new Map();
    const signedUrlCache = new Map();
    const failedSignCache = new Map();
    const imagePreloadCache = new Map();
    const imagePreloadResults = new Map();
    let imageTransformationsUnavailable = false;
    const FAILED_SIGN_TTL = 5 * 60 * 1000;
    const MIN_SIGNED_URL_SECONDS = 30;
    const MAX_SIGNED_URL_SECONDS = 15 * 60;
    const FAILED_ASSET_SESSION_KEY = 'classRecordMissingAssets.v1';
    const SIGNED_URL_SESSION_KEY = 'classRecordSignedUrls.v1';
    const displayTransforms = Object.freeze({
        written: Object.freeze({ width: 1200, height: 1800, resize: 'contain', quality: 78 }),
        illustration: Object.freeze({ width: 960, quality: 76 })
    });

    const normalizeImageTransform = (transform) => {
        if (!transform || typeof transform !== 'object') return null;
        const normalized = {};
        const width = Math.round(Number(transform.width));
        const height = Math.round(Number(transform.height));
        const quality = Math.round(Number(transform.quality));
        if (width >= 1 && width <= 2500) normalized.width = width;
        if (height >= 1 && height <= 2500) normalized.height = height;
        if (quality >= 20 && quality <= 100) normalized.quality = quality;
        if (['cover', 'contain', 'fill'].includes(transform.resize)) normalized.resize = transform.resize;
        return Object.keys(normalized).length ? normalized : null;
    };

    const getAssetCacheKey = (safePath, transform) => {
        const normalized = normalizeImageTransform(transform);
        return normalized ? `${safePath}|transform:${JSON.stringify(normalized)}` : safePath;
    };

    // Signed URLs and failed object paths are memory-only. Remove caches left
    // by older releases without restoring them into the current page.
    try {
        sessionStorage.removeItem(SIGNED_URL_SESSION_KEY);
        sessionStorage.removeItem(FAILED_ASSET_SESSION_KEY);
    } catch (error) {
        // Storage may be unavailable in privacy-restricted browsers.
    }

    const markAssetFailed = (path) => {
        failedSignCache.set(path, Date.now());
    };

    const clearAssetFailure = (path) => {
        failedSignCache.delete(path);
    };

    const loadScriptOnce = (src) => new Promise((resolve, reject) => {
        if ([...document.scripts].some((script) => script.src === src)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        if (/^https:\/\//i.test(src)) {
            script.crossOrigin = 'anonymous';
            script.referrerPolicy = 'no-referrer';
        }
        if (src === SUPABASE_SDK_URL) script.integrity = SUPABASE_SDK_INTEGRITY;
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
            storage: {
                signedUrlExpiresIn: Number(config.storage?.signedUrlExpiresIn),
                sensitiveSignedUrlExpiresIn: Number(config.storage?.sensitiveSignedUrlExpiresIn)
            },
            tables: {
                records: 'class_records',
                people: 'class_people',
                recordPages: 'class_record_pages',
                pageMessages: 'class_page_messages',
                pageSupplements: 'class_page_supplements',
                materials: 'class_materials',
                quizQuestions: 'class_quiz_questions',
                creditsPage: 'class_credits_page',
                ...(config.tables || {})
            }
        };
    };

    const isEnabled = () => {
        const config = window.CLASS_RECORD_SUPABASE || {};
        return Boolean(config.url && config.anonKey);
    };

    const getClient = async () => {
        if (window.ClassRecordSupabase?.getClient) {
            return window.ClassRecordSupabase.getClient();
        }
        const config = await getConfig();
        if (!config.url || !config.anonKey) throw new Error('Supabase is not configured.');
        if (!clientPromise) {
            clientPromise = loadScriptOnce(SUPABASE_SDK_URL).then(() => {
                if (!window.supabase?.createClient) throw new Error('Supabase SDK is unavailable.');
                return window.supabase.createClient(config.url, config.anonKey, {
                    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
                    global: {
                        headers: {
                            'x-class-record-access': window.getInviteAccessToken?.() || ''
                        }
                    }
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

    const normalizeRecordPageImagePath = (value) => {
        const raw = String(value || '').trim();
        if (/^https?:\/\//i.test(raw)) return raw;
        if (!raw) return '';
        return normalizePrivateStoragePath(raw);
    };

    const normalizeQuizImagePath = (value) => {
        const raw = normalizePrivateStoragePath(value).replace(/\\/g, '/');
        if (!raw || /^https?:\/\//i.test(raw) || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return '';
        if (raw.split('/').some((segment) => !segment || segment === '.' || segment === '..')) return '';
        if (!raw.startsWith('images/quiz/')) return '';
        return /\.(?:png|jpe?g|webp|gif)$/i.test(raw) ? raw : '';
    };

    const isSensitiveStoragePath = (path) => {
        const safePath = normalizePrivateStoragePath(path).replace(/\\/g, '/');
        return safePath.startsWith('hidden/') || safePath.startsWith('images/quiz/');
    };

    const getSignedUrlLifetime = (path, requestedLifetime, config) => {
        const configured = isSensitiveStoragePath(path)
            ? config.storage.sensitiveSignedUrlExpiresIn
            : config.storage.signedUrlExpiresIn;
        const safeConfigured = Math.min(MAX_SIGNED_URL_SECONDS, Math.max(MIN_SIGNED_URL_SECONDS, Number(configured) || MIN_SIGNED_URL_SECONDS));
        const requested = Number(requestedLifetime);
        if (!Number.isFinite(requested) || requested <= 0) return safeConfigured;
        return Math.min(safeConfigured, Math.max(MIN_SIGNED_URL_SECONDS, Math.round(requested)));
    };

    const getSignedUrlRefreshAt = (now, lifetime) => {
        const refreshBuffer = Math.min(30 * 1000, Math.max(5 * 1000, lifetime * 1000 * 0.2));
        return now + lifetime * 1000 - refreshBuffer;
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
            // The source JSON flag is authoritative. The column is only a
            // fallback for rows imported before `raw.hidden` was preserved.
            hidden: truthyHidden(Object.prototype.hasOwnProperty.call(raw, 'hidden') ? raw.hidden : row.hidden),
            imagePath: normalizeRecordPageImagePath(row.image_path || raw.imagePath || raw.image || raw.pageImage || ''),
        };
    };

    const loadRecords = async ({ onProgressStep, hidden = false } = {}) => {
        const config = await getConfig();
        const client = await getClient();
        const cacheKey = String(Boolean(hidden));
        if (!recordPromises.has(cacheKey)) {
            let query = client.from(config.tables.records)
                .select('*')
                .order('record_index', { ascending: true });
            // `raw.hidden` mirrors the source JSON and is authoritative. An
            // explicit OR is required because `neq` alone discards SQL NULLs.
            query = hidden
                ? query.eq('raw->>hidden', 'true')
                : query.or('raw->>hidden.is.null,raw->>hidden.neq.true');
            const promise = query
                .then(({ data, error }) => {
                    if (error) throw error;
                    return (data || []).map(normalizeRecord);
                })
                .catch((error) => {
                    recordPromises.delete(cacheKey);
                    throw error;
                });
            recordPromises.set(cacheKey, promise);
        }
        const records = await recordPromises.get(cacheKey);
        return records.filter((record) => record.hidden === Boolean(hidden)).map((record) => {
            if (typeof onProgressStep === 'function') onProgressStep(record.fileName);
            return record;
        });
    };

    const loadPeople = async ({ onProgressStep } = {}) => {
        const config = await getConfig();
        if (!peoplePromise) {
            peoplePromise = selectAll(config.tables.people, '*', 'id').catch((error) => {
                peoplePromise = null;
                throw error;
            });
        }
        const rows = await peoplePromise;
        return rows.map((row, index) => {
            const raw = parseRaw(row);
            const item = {
                ...raw,
                id: row.person_id || raw.id || raw.name || `person-${index + 1}`,
                name: row.name || raw.name || raw.displayName || raw.display_name || '',
                aliases: Array.isArray(row.aliases) ? row.aliases : (Array.isArray(raw.aliases) ? raw.aliases : []),
                alias: row.alias || raw.alias || '',
                role: row.role || raw.role || 'student',
                subject: row.subject ?? raw.subject ?? '',
                main: row.main === true || raw.main === true,
                bio: row.bio || raw.bio || '',
                avatarUrl: row.avatar_url || raw.avatarUrl || raw.avatar || '',
            };
            if (typeof onProgressStep === 'function') onProgressStep(item.id);
            return item;
        });
    };

    const loadPageSupplements = async ({ hidden = false } = {}) => {
        const config = await getConfig();
        const cacheKey = String(Boolean(hidden));
        if (!pageSupplementPromises.has(cacheKey)) {
            const promise = selectAll(config.tables.pageSupplements, '*', 'sort_order', { hidden: Boolean(hidden) })
                .catch((error) => {
                    pageSupplementPromises.delete(cacheKey);
                    throw error;
                });
            pageSupplementPromises.set(cacheKey, promise);
        }
        const rows = await pageSupplementPromises.get(cacheKey);
        return rows.map((row, index) => {
            const raw = parseRaw(row);
            return {
                ...raw,
                id: row.file_name || raw.id || `${row.page || raw.page}-${row.supplement_index || index + 1}`,
                fileName: row.file_name || raw.fileName || '',
                page: String(row.page ?? raw.page ?? '').trim(),
                supplementIndex: Number(row.supplement_index ?? raw.supplementIndex ?? index + 1),
                author: row.author || raw.author || raw.recorder || '',
                content: row.content || raw.content || raw.text || '',
                hidden: truthyHidden(row.hidden ?? raw.hidden)
            };
        }).filter((item) => item.page && item.content);
    };

    const loadMaterials = async ({ onProgressStep } = {}) => {
        const config = await getConfig();
        if (!materialsPromise) {
            materialsPromise = selectAll(config.tables.materials, '*', 'sort_order')
                .then((rows) => rows.map((row, index) => {
                    const raw = parseRaw(row);
                    const item = {
                        ...raw,
                        id: row.material_id || raw.id || `material-${index + 1}`,
                        title: row.title || raw.title || raw.name || '',
                        content: row.content || raw.content || raw.description || ''
                    };
                    if (typeof onProgressStep === 'function') onProgressStep(item.id);
                    return item;
                }).filter((item) => item.id && item.title))
                .catch((error) => {
                    materialsPromise = null;
                    throw error;
                });
        }
        return materialsPromise;
    };

    const normalizeTextList = (value) => {
        if (Array.isArray(value)) {
            return value
                .map((item) => {
                    if (typeof item === 'string') return item;
                    if (item && typeof item === 'object') return item.content || item.text || item.label || '';
                    return '';
                })
                .map((item) => String(item || '').trim())
                .filter(Boolean);
        }
        const text = String(value || '').trim();
        return text ? [text] : [];
    };

    const normalizeCreditSections = (value) => {
        const list = Array.isArray(value) ? value : [];
        return list.map((section, index) => {
            if (typeof section === 'string') {
                return {
                    id: `section-${index + 1}`,
                    title: '',
                    members: [section]
                };
            }
            const item = section && typeof section === 'object' ? section : {};
            return {
                id: String(item.id || `section-${index + 1}`),
                title: String(item.title || item.name || '').trim(),
                members: normalizeTextList(item.members || item.items || item.content || item.text)
            };
        }).filter((section) => section.title || section.members.length);
    };

    const normalizeOriginalImages = (value) => {
        const list = Array.isArray(value) ? value : [];
        return list.map((item, index) => {
            if (typeof item === 'string') {
                return {
                    id: `image-${index + 1}`,
                    title: '',
                    content: item
                };
            }
            const image = item && typeof item === 'object' ? item : {};
            return {
                id: String(image.id || `image-${index + 1}`),
                title: String(image.title || image.name || '').trim(),
                content: String(image.content || image.text || image.description || '').trim()
            };
        }).filter((item) => item.title || item.content);
    };

    const loadCreditsPage = async () => {
        const config = await getConfig();
        if (!creditsPagePromise) {
            creditsPagePromise = selectAll(config.tables.creditsPage, '*', null, { id: 'main' })
                .then((rows) => {
                    const row = rows[0];
                    if (!row) return null;
                    const raw = parseRaw(row);
                    const source = {
                        ...raw,
                        title: row.title ?? raw.title,
                        sections: row.sections ?? raw.sections,
                        thanks: row.thanks ?? raw.thanks,
                        originalImages: row.original_images ?? raw.originalImages ?? raw.original_images,
                        updatedAt: row.updated_at ?? raw.updatedAt ?? raw.updated_at
                    };
                    return {
                        id: row.id || raw.id || 'main',
                        title: String(source.title || '').trim(),
                        sections: normalizeCreditSections(source.sections),
                        thanks: normalizeTextList(source.thanks),
                        originalImages: normalizeOriginalImages(source.originalImages),
                        updatedAt: source.updatedAt || ''
                    };
                })
                .catch((error) => {
                    creditsPagePromise = null;
                    throw error;
                });
        }
        return creditsPagePromise;
    };

    const loadRecordPages = async ({ hidden = false } = {}) => {
        const config = await getConfig();
        const cacheKey = String(Boolean(hidden));
        if (!recordPagePromises.has(cacheKey)) {
            const promise = selectAll(config.tables.recordPages, '*', 'sort_order', { hidden: Boolean(hidden) })
                .catch((error) => {
                    recordPagePromises.delete(cacheKey);
                    throw error;
                });
            recordPagePromises.set(cacheKey, promise);
        }
        const rows = await recordPagePromises.get(cacheKey);
        return rows.map((row, index) => {
            const raw = parseRaw(row);
            const page = String(row.page ?? raw.page ?? index + 1).trim();
            return {
                ...raw,
                page,
                startFile: row.start_file || raw.startFile || raw.start || '',
                endFile: row.end_file || raw.endFile || raw.end || '',
                imagePath: normalizeRecordPageImagePath(row.image_path || raw.imagePath || raw.image || ''),
                hidden: truthyHidden(row.hidden ?? raw.hidden)
            };
        });
    };

    const loadPageMessages = async () => {
        const config = await getConfig();
        if (!pageMessagesPromise) {
            pageMessagesPromise = selectAll(config.tables.pageMessages, '*', 'page')
                .then((rows) => rows.map((row) => {
                    const raw = parseRaw(row);
                    return {
                        ...raw,
                        page: String(row.page ?? raw.page ?? '').trim(),
                        content: row.content || raw.content || '',
                        author: row.author || raw.author || raw.recorder || ''
                    };
                }).filter((item) => item.page && item.content))
                .catch((error) => {
                    pageMessagesPromise = null;
                    throw error;
                });
        }
        return pageMessagesPromise;
    };

    const normalizeQuizQuestion = (row, index = 0) => {
        const raw = parseRaw(row);
        const contentKeys = [...new Set([
            row.content_key,
            row.question_group,
            raw.contentKey,
            raw.content,
            raw.group
        ].map((value) => String(value || '').trim()).filter(Boolean))];
        return {
            ...raw,
            id: raw.id || row.id || `quiz-${index + 1}`,
            contentKey: contentKeys[0] || '',
            contentKeys,
            type: row.question_type || raw.type || 'choice',
            prompt: row.prompt || raw.prompt || '',
            choices: Array.isArray(row.choices) ? row.choices : (Array.isArray(raw.choices) ? raw.choices : []),
            answer: row.answer || raw.answer || '',
            explanation: row.explanation || raw.explanation || '',
            // Quiz images are private Storage objects. The UI signs this
            // validated object path only after the invite gate resolves.
            image: normalizeQuizImagePath(row.image_path || raw.image || raw.imagePath || '')
        };
    };

    const loadAllQuizQuestions = async ({ force = false } = {}) => {
        const config = await getConfig();
        if (force) quizQuestionsPromise = null;
        if (!quizQuestionsPromise) {
            quizQuestionsPromise = selectAll(config.tables.quizQuestions, '*', 'sort_order')
                .then((rows) => rows.map(normalizeQuizQuestion))
                .catch((error) => {
                    quizQuestionsPromise = null;
                    throw error;
                });
        }
        return quizQuestionsPromise;
    };

    const loadQuizQuestions = async (contentKey, { force = false } = {}) => {
        const key = String(contentKey || '').trim();
        const rows = await loadAllQuizQuestions({ force });
        return rows.filter((row) => (row.contentKeys || [row.contentKey])
            .some((value) => String(value || '').trim() === key));
    };

    const signAssetUrl = async (path, { expiresIn, quiet = false, forceRefresh = false, transform = null } = {}) => {
        const safePath = normalizePrivateStoragePath(path);
        if (!safePath || /^https?:\/\//i.test(safePath)) return safePath;
        const config = await getConfig();
        const imageTransform = imageTransformationsUnavailable ? null : normalizeImageTransform(transform);
        const cacheKey = getAssetCacheKey(safePath, imageTransform);
        const now = Date.now();
        const lifetime = getSignedUrlLifetime(safePath, expiresIn, config);
        if (forceRefresh) {
            signedUrlCache.delete(cacheKey);
            failedSignCache.delete(cacheKey);
        }
        const failedAt = failedSignCache.get(cacheKey);
        if (failedAt && now - failedAt < FAILED_SIGN_TTL) {
            if (quiet) return '';
            throw new Error(`Storage asset unavailable: ${safePath}`);
        }
        const cached = signedUrlCache.get(cacheKey);
        if (cached && cached.refreshAt > now) return cached.promise;
        if (cached) signedUrlCache.delete(cacheKey);
        const client = await getClient();
        const options = imageTransform ? { transform: imageTransform } : undefined;
        const promise = client.storage.from(config.bucket).createSignedUrl(safePath, lifetime, options)
            .then(({ data, error }) => {
                if (error) throw error;
                clearAssetFailure(cacheKey);
                const url = data?.signedUrl || '';
                const item = signedUrlCache.get(cacheKey);
                if (item && url) {
                    item.url = url;
                }
                return url;
            })
            .catch((error) => {
                signedUrlCache.delete(cacheKey);
                markAssetFailed(cacheKey);
                if (quiet) return '';
                throw error;
            });
        signedUrlCache.set(cacheKey, {
            promise,
            expiresAt: now + lifetime * 1000,
            refreshAt: getSignedUrlRefreshAt(now, lifetime)
        });
        return promise;
    };

    const signAssetUrls = async (paths, { expiresIn, quiet = true } = {}) => {
        const originals = [...new Set((paths || []).filter(Boolean))];
        const result = new Map();
        const cachedLoads = [];
        const uncached = [];
        const now = Date.now();
        const config = await getConfig();
        originals.forEach((original) => {
            const safePath = normalizePrivateStoragePath(original);
            if (!safePath || /^https?:\/\//i.test(safePath)) {
                if (safePath) result.set(original, safePath);
                return;
            }
            const cached = signedUrlCache.get(safePath);
            if (cached && cached.refreshAt > now) {
                cachedLoads.push(cached.promise.then((url) => { if (url) result.set(original, url); }));
                return;
            }
            if (!failedSignCache.has(safePath) || now - failedSignCache.get(safePath) >= FAILED_SIGN_TTL) {
                uncached.push({ original, safePath, lifetime: getSignedUrlLifetime(safePath, expiresIn, config) });
            }
        });
        await Promise.allSettled(cachedLoads);
        if (uncached.length) {
            const client = await getClient();
            const groups = new Map();
            uncached.forEach((item) => {
                if (!groups.has(item.lifetime)) groups.set(item.lifetime, []);
                groups.get(item.lifetime).push(item);
            });
            const groupResults = await Promise.allSettled([...groups.entries()].map(async ([lifetime, candidates]) => {
                const { data, error } = await client.storage
                    .from(config.bucket)
                    .createSignedUrls(candidates.map((item) => item.safePath), lifetime);
                if (error) throw error;
                (data || []).forEach((item, index) => {
                    const candidate = candidates[index];
                    const signedUrl = item?.signedUrl || '';
                    if (!candidate || !signedUrl || item?.error) {
                        if (candidate) markAssetFailed(candidate.safePath);
                        return;
                    }
                    clearAssetFailure(candidate.safePath);
                    signedUrlCache.set(candidate.safePath, {
                        url: signedUrl,
                        promise: Promise.resolve(signedUrl),
                        expiresAt: now + lifetime * 1000,
                        refreshAt: getSignedUrlRefreshAt(now, lifetime)
                    });
                    result.set(candidate.original, signedUrl);
                });
            }));
            const failedGroups = groupResults.filter((item) => item.status === 'rejected');
            if (failedGroups.length) {
                const failedLifetimes = new Set([...groups.keys()].filter((_, index) => groupResults[index]?.status === 'rejected'));
                const fallbackCandidates = uncached.filter((item) => failedLifetimes.has(item.lifetime));
                const fallback = await Promise.allSettled(fallbackCandidates.map(async ({ original, safePath, lifetime }) => {
                    const url = await signAssetUrl(safePath, { expiresIn: lifetime, quiet });
                    if (url) result.set(original, url);
                }));
                if (!quiet && fallback.length && fallback.every((item) => item.status === 'rejected')) throw failedGroups[0].reason;
            }
        }
        return result;
    };

    const preloadAsset = async (path, { priority = 'low', transform = null } = {}) => {
        const safePath = normalizePrivateStoragePath(path);
        if (!safePath) return null;
        const requestedTransform = imageTransformationsUnavailable ? null : normalizeImageTransform(transform);
        const cacheKey = getAssetCacheKey(safePath, requestedTransform);
        if (imagePreloadCache.has(cacheKey)) return imagePreloadCache.get(cacheKey);
        const loadVariant = async (imageTransform) => {
            const url = await signAssetUrl(safePath, { quiet: true, transform: imageTransform });
            if (!url) return null;
            return new Promise((resolve) => {
                const image = new Image();
                image.decoding = 'async';
                image.fetchPriority = priority;
                image.onload = () => {
                    const result = {
                        url,
                        width: image.naturalWidth,
                        height: image.naturalHeight
                    };
                    imagePreloadResults.set(getAssetCacheKey(safePath, imageTransform), result);
                    resolve(result);
                };
                image.onerror = () => resolve(null);
                image.src = url;
            });
        };
        const promise = (async () => {
            const transformed = await loadVariant(requestedTransform);
            if (transformed) return transformed.url;
            if (!requestedTransform) return null;
            const original = await loadVariant(null);
            if (original) {
                imageTransformationsUnavailable = true;
                imagePreloadResults.set(cacheKey, original);
                return original.url;
            }
            return null;
        })();
        const reusablePromise = promise.then((url) => {
            if (!url) imagePreloadCache.delete(cacheKey);
            return url;
        });
        imagePreloadCache.set(cacheKey, reusablePromise);
        return reusablePromise;
    };

    const getPreloadedAsset = (path, { transform = null } = {}) => {
        const safePath = normalizePrivateStoragePath(path);
        if (!safePath) return null;
        const requestedTransform = imageTransformationsUnavailable ? null : normalizeImageTransform(transform);
        return imagePreloadResults.get(getAssetCacheKey(safePath, requestedTransform)) || null;
    };

    const preloadAdminQuizImages = () => {
        if (adminQuizPreloadPromise) return adminQuizPreloadPromise;
        adminQuizPreloadPromise = (async () => {
            const isAdmin = await window.ClassRecordSupabase?.hasAdminAccess?.();
            if (!isAdmin) return { admin: false, total: 0, loaded: 0 };
            const questions = await loadAllQuizQuestions();
            const paths = [...new Set(questions.map((item) => item.image).filter(Boolean))];
            let nextIndex = 0;
            let loaded = 0;
            const worker = async () => {
                while (nextIndex < paths.length) {
                    const path = paths[nextIndex++];
                    try {
                        if (await preloadAsset(path, { priority: 'low' })) loaded += 1;
                    } catch (error) {
                        // Continue warming the remaining images after an isolated failure.
                    }
                }
            };
            await Promise.all(Array.from({ length: Math.min(4, paths.length) }, worker));
            return { admin: true, total: paths.length, loaded };
        })().catch((error) => {
            adminQuizPreloadPromise = null;
            throw error;
        });
        window.ClassRecordAdminQuizPreloadPromise = adminQuizPreloadPromise;
        return adminQuizPreloadPromise;
    };

    const listAssetPaths = async (directory, { search = '', limit = 100 } = {}) => {
        const safeDirectory = normalizePrivateStoragePath(directory).replace(/\/+$/, '');
        const cacheKey = `${safeDirectory}|${search}|${limit}`;
        if (!assetListPromises.has(cacheKey)) {
            const promise = Promise.all([getConfig(), getClient()]).then(async ([config, client]) => {
                const { data, error } = await client.storage.from(config.bucket).list(safeDirectory, {
                    limit,
                    offset: 0,
                    search: search || undefined,
                    sortBy: { column: 'name', order: 'asc' }
                });
                if (error) throw error;
                return (data || [])
                    .filter((item) => item?.name)
                    .map((item) => `${safeDirectory ? `${safeDirectory}/` : ''}${item.name}`);
            }).catch((error) => {
                assetListPromises.delete(cacheKey);
                throw error;
            });
            assetListPromises.set(cacheKey, promise);
        }
        return assetListPromises.get(cacheKey);
    };

    const resolveAssetElements = async (root = document) => {
        const imageNodes = [...root.querySelectorAll('img[data-secure-src]:not([data-secure-bound])')];
        const linkNodes = [...root.querySelectorAll('a[data-secure-href]')];
        const lazyImages = imageNodes.filter((node) => node.loading === 'lazy' && 'IntersectionObserver' in window);
        const immediateImages = imageNodes.filter((node) => !lazyImages.includes(node));
        const paths = [
            ...immediateImages
                .map((node) => node.getAttribute('data-secure-src'))
                .filter((path) => !getPreloadedAsset(path)?.url),
            ...linkNodes.map((node) => node.getAttribute('data-secure-href'))
        ].filter(Boolean);
        const signed = await signAssetUrls(paths).catch((error) => {
            window.ClassRecordDiagnostics?.warn('Secure asset signing failed', error);
            return new Map();
        });
        const assignImage = (node, src) => {
            if (src && node.isConnected) {
                node.src = src;
                return;
            }
            if (node.isConnected) node.dispatchEvent(new Event('error'));
        };
        immediateImages.forEach((node) => {
            const path = node.getAttribute('data-secure-src');
            const src = getPreloadedAsset(path)?.url || signed.get(path);
            assignImage(node, src);
            node.dataset.secureBound = 'true';
        });
        linkNodes.forEach((node) => {
            const href = signed.get(node.getAttribute('data-secure-href'));
            if (href) node.href = href;
        });
        if (lazyImages.length) {
            const observer = new IntersectionObserver((entries) => {
                const visibleNodes = entries
                    .filter((entry) => entry.isIntersecting)
                    .map((entry) => entry.target);
                visibleNodes.forEach((node) => observer.unobserve(node));
                if (!visibleNodes.length) return;
                signAssetUrls(visibleNodes.map((node) => node.getAttribute('data-secure-src')))
                    .then((urls) => visibleNodes.forEach((node) => {
                        assignImage(node, urls.get(node.getAttribute('data-secure-src')));
                    }))
                    .catch(() => visibleNodes.forEach((node) => assignImage(node, '')));
            }, { rootMargin: '320px 0px' });
            lazyImages.forEach((node) => {
                node.dataset.secureBound = 'true';
                observer.observe(node);
            });
        }
    };

    const clearSecureResourceState = () => {
        recordPromises.clear();
        peoplePromise = null;
        recordPagePromises.clear();
        pageSupplementPromises.clear();
        pageMessagesPromise = null;
        materialsPromise = null;
        quizQuestionsPromise = null;
        adminQuizPreloadPromise = null;
        creditsPagePromise = null;
        assetListPromises.clear();
        signedUrlCache.clear();
        failedSignCache.clear();
        imagePreloadCache.clear();
        imagePreloadResults.clear();
        imageTransformationsUnavailable = false;
        try {
            sessionStorage.removeItem(SIGNED_URL_SESSION_KEY);
            sessionStorage.removeItem(FAILED_ASSET_SESSION_KEY);
        } catch (error) {
            // Memory caches were still cleared.
        }
    };

    window.addEventListener('classrecordcacheclearing', clearSecureResourceState);
    window.addEventListener('pagehide', clearSecureResourceState);
    window.addEventListener('pageshow', (event) => {
        // `pagehide` clears signed URLs so a bfcache entry cannot retain
        // private URLs in memory. Restore its already-rendered image nodes
        // with fresh signatures when the browser brings that entry back.
        if (!event.persisted || !document.querySelectorAll) return;
        document.querySelectorAll('img[data-secure-src][data-secure-bound]').forEach((node) => {
            node.removeAttribute('data-secure-bound');
        });
        resolveAssetElements(document).catch((error) => {
            window.ClassRecordDiagnostics?.warn('Secure asset restore failed', error);
        });
    });

    window.ClassRecordData = {
        displayTransforms,
        resolveAssetElements,
        getClient,
        getConfig,
        getPreloadedAsset,
        isEnabled,
        loadCreditsPage,
        loadMaterials,
        loadPageSupplements,
        loadPeople,
        loadAllQuizQuestions,
        loadQuizQuestions,
        listAssetPaths,
        loadRecordPages,
        loadPageMessages,
        loadRecords,
        normalizePrivateStoragePath,
        preloadAsset,
        preloadAdminQuizImages,
        signAssetUrl,
        signAssetUrls,
        clearSecureResourceState
    };
})();

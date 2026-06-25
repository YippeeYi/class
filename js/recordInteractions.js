/************************************************************
 * recordInteractions.js
 * Supabase 记录互动：轻量点赞、收藏、转发、评论
 ************************************************************/

(() => {
    const MAX_COMMENT_LENGTH = 500;
    const pendingActions = new Set();
    const summaryCache = new Map();
    const commentsCache = new Map();
    let currentProfile = null;

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const escapeAttr = (value) => escapeHtml(value).replace(/`/g, '&#96;');
    const normalizeKey = (value) => String(value || '').trim();
    const getTables = () => window.ClassRecordSupabase?.getConfig().tables || {};
    const REACTION_META = {
        like: { activeIcon: '👍🏻', inactiveIcon: '👍', on: '已点赞', off: '已取消点赞' },
        favorite: { activeIcon: '⭐', inactiveIcon: '☆', on: '已收藏', off: '已取消收藏' }
    };
    const emptySummary = (recordKey) => ({ recordKey, likeCount: 0, favoriteCount: 0, commentCount: 0, myLiked: false, myFavorited: false });

    const getRecordElements = (container) => Array.from(container?.querySelectorAll('.record[data-record-key]') || []);

    const getProfile = async () => {
        if (currentProfile) return currentProfile;
        currentProfile = await window.ClassRecordSupabase.getProfile().catch(() => null) || {};
        return currentProfile;
    };

    const formatTime = (value) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const queryChunks = async (items, query) => {
        const chunkSize = 120;
        const output = [];
        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const rows = await query(chunk);
            output.push(...rows);
        }
        return output;
    };

    const loadSummariesWithRpc = async (client, keys) => {
        const { data, error } = await client.rpc('get_record_interaction_summaries', { record_keys: keys });
        if (error) throw error;
        return data || [];
    };

    const loadSummariesFallback = async (client, keys, userId) => {
        const tables = getTables();
        const summaries = new Map(keys.map((key) => [key, emptySummary(key)]));

        const reactions = await queryChunks(keys, async (chunk) => {
            const { data, error } = await client
                .from(tables.reactions)
                .select('record_key,type,user_id')
                .in('record_key', chunk);
            if (error) throw error;
            return data || [];
        });

        reactions.forEach((row) => {
            const item = summaries.get(row.record_key);
            if (!item) return;
            if (row.type === 'like') {
                item.likeCount += 1;
                item.myLiked = item.myLiked || row.user_id === userId;
            }
            if (row.type === 'favorite') {
                item.favoriteCount += 1;
                item.myFavorited = item.myFavorited || row.user_id === userId;
            }
        });

        const comments = await queryChunks(keys, async (chunk) => {
            const { data, error } = await client
                .from(tables.comments)
                .select('record_key')
                .in('record_key', chunk);
            if (error) throw error;
            return data || [];
        });

        comments.forEach((row) => {
            const item = summaries.get(row.record_key);
            if (item) item.commentCount += 1;
        });

        return Array.from(summaries.values());
    };

    const loadSummaries = async (recordKeys) => {
        const keys = Array.from(new Set(recordKeys.map(normalizeKey).filter(Boolean)));
        if (!keys.length || !window.ClassRecordSupabase?.isConfigured()) return new Map();

        const client = await window.ClassRecordSupabase.getClient();
        const session = await window.ClassRecordSupabase.getSession();
        const userId = session?.user?.id;
        let rows;
        try {
            rows = await loadSummariesWithRpc(client, keys);
        } catch (error) {
            rows = await loadSummariesFallback(client, keys, userId);
        }

        const summaries = new Map(keys.map((key) => [key, emptySummary(key)]));
        rows.forEach((row) => {
            const recordKey = row.record_key || row.recordKey;
            if (!summaries.has(recordKey)) return;
            summaries.set(recordKey, {
                recordKey,
                likeCount: Number(row.like_count ?? row.likeCount ?? 0),
                favoriteCount: Number(row.favorite_count ?? row.favoriteCount ?? 0),
                commentCount: Number(row.comment_count ?? row.commentCount ?? 0),
                myLiked: Boolean(row.my_liked ?? row.myLiked),
                myFavorited: Boolean(row.my_favorited ?? row.myFavorited)
            });
        });
        summaries.forEach((value, key) => summaryCache.set(key, value));
        return summaries;
    };

    const renderSummary = (recordEl, summary) => {
        const likeBtn = recordEl.querySelector('[data-action="toggle-reaction"][data-type="like"]');
        const favoriteBtn = recordEl.querySelector('[data-action="toggle-reaction"][data-type="favorite"]');
        const commentBtn = recordEl.querySelector('[data-action="toggle-comments"]');
        if (likeBtn) {
            likeBtn.classList.toggle('is-active', summary.myLiked);
            likeBtn.setAttribute('aria-pressed', String(summary.myLiked));
            likeBtn.querySelector('.record-social-emoji').textContent = summary.myLiked ? REACTION_META.like.activeIcon : REACTION_META.like.inactiveIcon;
            likeBtn.querySelector('strong').textContent = String(summary.likeCount);
        }
        if (favoriteBtn) {
            favoriteBtn.classList.toggle('is-active', summary.myFavorited);
            favoriteBtn.setAttribute('aria-pressed', String(summary.myFavorited));
            favoriteBtn.querySelector('.record-social-emoji').textContent = summary.myFavorited ? REACTION_META.favorite.activeIcon : REACTION_META.favorite.inactiveIcon;
            favoriteBtn.querySelector('strong').textContent = String(summary.favoriteCount);
        }
        if (commentBtn) {
            commentBtn.querySelector('strong').textContent = String(summary.commentCount);
        }
    };

    const showStatus = (recordEl, message, tone = 'info') => {
        const status = recordEl.querySelector('.record-social-status');
        if (!status) return;
        status.textContent = message || '';
        status.dataset.tone = tone;
        window.clearTimeout(status._clearTimer);
        if (message) {
            status._clearTimer = window.setTimeout(() => {
                status.textContent = '';
                status.dataset.tone = '';
            }, 1600);
        }
    };

    const renderError = (recordEl, message) => {
        const status = recordEl.querySelector('.record-social-status');
        if (status) {
            status.textContent = message || '互动操作失败。';
            status.dataset.tone = 'error';
        }
    };

    const renderComments = (comments, userId) => {
        if (!comments.length) return '<div class="record-comment-empty">暂无评论。</div>';
        return comments.map((comment) => {
            const canDelete = comment.user_id === userId;
            return `
                <article class="record-comment" data-comment-id="${escapeAttr(comment.id)}">
                    <div class="record-comment-meta"><strong>${escapeHtml(comment.author_name || '同学')}</strong><span>${escapeHtml(formatTime(comment.created_at))}</span></div>
                    <p>${escapeHtml(comment.body)}</p>
                    ${canDelete ? '<button type="button" class="record-comment-delete" data-action="delete-comment">删除</button>' : ''}
                </article>
            `;
        }).join('');
    };

    const loadComments = async (recordKey, { force = false } = {}) => {
        if (!force && commentsCache.has(recordKey)) return commentsCache.get(recordKey);
        const client = await window.ClassRecordSupabase.getClient();
        const { data, error } = await client
            .from(getTables().comments)
            .select('id,record_key,user_id,body,author_name,created_at')
            .eq('record_key', recordKey)
            .order('created_at', { ascending: true });
        if (error) throw error;
        commentsCache.set(recordKey, data || []);
        return data || [];
    };

    const renderCommentList = async (recordEl, { force = false } = {}) => {
        const recordKey = normalizeKey(recordEl.dataset.recordKey);
        const listEl = recordEl.querySelector('.record-comment-list');
        if (!listEl) return;
        listEl.innerHTML = '<div class="record-comment-empty">评论加载中…</div>';
        const session = await window.ClassRecordSupabase.getSession();
        const comments = await loadComments(recordKey, { force });
        listEl.innerHTML = renderComments(comments, session?.user?.id);
        const summary = summaryCache.get(recordKey) || emptySummary(recordKey);
        summary.commentCount = comments.length;
        summaryCache.set(recordKey, summary);
        renderSummary(recordEl, summary);
    };

    const refreshRecordSummary = async (recordEl) => {
        const key = normalizeKey(recordEl.dataset.recordKey);
        const summaries = await loadSummaries([key]);
        renderSummary(recordEl, summaries.get(key) || emptySummary(key));
    };

    const toggleReaction = async (recordEl, type) => {
        const key = normalizeKey(recordEl.dataset.recordKey);
        const actionKey = `${key}:${type}`;
        if (pendingActions.has(actionKey)) return;
        pendingActions.add(actionKey);

        const client = await window.ClassRecordSupabase.getClient();
        const session = await window.ClassRecordSupabase.getSession();
        const userId = session?.user?.id;
        const summary = summaryCache.get(key) || emptySummary(key);
        const active = type === 'like' ? summary.myLiked : summary.myFavorited;
        const tables = getTables();

        const optimistic = { ...summary };
        if (type === 'like') {
            optimistic.myLiked = !active;
            optimistic.likeCount += active ? -1 : 1;
        } else {
            optimistic.myFavorited = !active;
            optimistic.favoriteCount += active ? -1 : 1;
        }
        summaryCache.set(key, optimistic);
        renderSummary(recordEl, optimistic);

        try {
            if (active) {
                const { error } = await client.from(tables.reactions).delete().eq('record_key', key).eq('type', type).eq('user_id', userId);
                if (error) throw error;
            } else {
                const { error } = await client.from(tables.reactions).upsert({ record_key: key, type, user_id: userId }, { onConflict: 'record_key,user_id,type' });
                if (error) throw error;
            }
            showStatus(recordEl, active ? REACTION_META[type].off : REACTION_META[type].on, active ? 'info' : 'success');
            if (type === 'favorite') {
                window.dispatchEvent(new CustomEvent('recordfavoritechange', { detail: { recordKey: key, favorited: !active } }));
            }
            await refreshRecordSummary(recordEl);
        } catch (error) {
            summaryCache.set(key, summary);
            renderSummary(recordEl, summary);
            throw error;
        } finally {
            pendingActions.delete(actionKey);
        }
    };

    const shareRecord = async (recordEl) => {
        const anchor = recordEl.id ? `#${recordEl.id}` : '';
        const url = `${location.origin}${location.pathname}${location.search}${anchor}`;
        if (navigator.share) {
            await navigator.share({ title: '编日史记录', url }).catch(async (error) => {
                if (error?.name !== 'AbortError') throw error;
            });
            return;
        }
        await navigator.clipboard.writeText(url);
        const status = recordEl.querySelector('.record-social-status');
        if (status) {
            status.textContent = '链接已复制。';
            status.dataset.tone = 'success';
            window.setTimeout(() => { status.textContent = ''; status.dataset.tone = ''; }, 1200);
        }
    };

    const submitComment = async (recordEl, form) => {
        const textarea = form.querySelector('textarea[name="comment"]');
        const body = textarea.value.trim();
        if (!body) return;
        if (body.length > MAX_COMMENT_LENGTH) {
            textarea.setCustomValidity(`评论最多 ${MAX_COMMENT_LENGTH} 字。`);
            textarea.reportValidity();
            return;
        }
        textarea.setCustomValidity('');
        form.querySelectorAll('textarea, button').forEach((el) => { el.disabled = true; });

        try {
            const client = await window.ClassRecordSupabase.getClient();
            const session = await window.ClassRecordSupabase.getSession();
            const profile = await getProfile();
            const recordKey = normalizeKey(recordEl.dataset.recordKey);
            const { error } = await client.from(getTables().comments).insert({
                record_key: recordKey,
                user_id: session?.user?.id,
                body,
                author_name: profile.displayName || profile.username || '同学'
            });
            if (error) throw error;
            textarea.value = '';
            commentsCache.delete(recordKey);
            await renderCommentList(recordEl, { force: true });
        } finally {
            form.querySelectorAll('textarea, button').forEach((el) => { el.disabled = false; });
        }
    };

    const deleteComment = async (recordEl, commentId) => {
        if (!commentId) return;
        const confirmed = window.confirm('确定删除这条评论吗？');
        if (!confirmed) return;
        const client = await window.ClassRecordSupabase.getClient();
        const { error } = await client.from(getTables().comments).delete().eq('id', commentId);
        if (error) throw error;
        commentsCache.delete(normalizeKey(recordEl.dataset.recordKey));
        await renderCommentList(recordEl, { force: true });
    };

    const bindContainer = (container) => {
        if (!container || container.dataset.recordInteractionsBound === 'true') return;
        container.dataset.recordInteractionsBound = 'true';

        container.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;
            const recordEl = button.closest('.record[data-record-key]');
            if (!recordEl) return;

            try {
                if (button.dataset.action === 'toggle-reaction') {
                    await toggleReaction(recordEl, button.dataset.type);
                    return;
                }
                if (button.dataset.action === 'toggle-comments') {
                    const comments = recordEl.querySelector('.record-comments');
                    if (!comments) return;
                    comments.hidden = !comments.hidden;
                    button.setAttribute('aria-expanded', String(!comments.hidden));
                    if (!comments.hidden) await renderCommentList(recordEl);
                    return;
                }
                if (button.dataset.action === 'share-record') {
                    await shareRecord(recordEl);
                    return;
                }
                if (button.dataset.action === 'delete-comment') {
                    await deleteComment(recordEl, button.closest('.record-comment')?.dataset.commentId);
                }
            } catch (error) {
                console.warn('记录互动操作失败：', error);
                renderError(recordEl, error?.message || '互动操作失败，请稍后再试。');
            }
        });

        container.addEventListener('submit', async (event) => {
            const form = event.target.closest('.record-comment-form');
            if (!form) return;
            event.preventDefault();
            const recordEl = form.closest('.record[data-record-key]');
            if (!recordEl) return;
            try {
                await submitComment(recordEl, form);
            } catch (error) {
                console.warn('评论提交失败：', error);
                renderError(recordEl, error?.message || '评论提交失败，请稍后再试。');
            }
        });
    };

    const hydrate = async (container, records) => {
        const recordEls = getRecordElements(container);
        if (!recordEls.length) return;
        bindContainer(container);
        if (!window.ClassRecordSupabase?.isConfigured()) return;
        const keys = records?.map((record) => record.fileName || record.id) || recordEls.map((el) => el.dataset.recordKey);
        try {
            await getProfile();
            const summaries = await loadSummaries(keys);
            recordEls.forEach((el) => {
                const key = normalizeKey(el.dataset.recordKey);
                renderSummary(el, summaries.get(key) || emptySummary(key));
            });
        } catch (error) {
            console.warn('记录互动加载失败：', error);
        }
    };

    const getFavoriteKeys = async () => {
        const client = await window.ClassRecordSupabase.getClient();
        const session = await window.ClassRecordSupabase.getSession();
        const { data, error } = await client
            .from(getTables().reactions)
            .select('record_key')
            .eq('type', 'favorite')
            .eq('user_id', session?.user?.id);
        if (error) throw error;
        return new Set((data || []).map((row) => row.record_key));
    };

    window.RecordInteractions = { hydrate, refreshRecord: refreshRecordSummary, getFavoriteKeys };
})();

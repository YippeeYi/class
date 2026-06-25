/************************************************************
 * recordInteractions.js
 * Supabase 记录互动：多情绪、收藏、分享、评论、评论点赞
 ************************************************************/

(() => {
    const MAX_COMMENT_LENGTH = 500;
    const pendingActions = new Set();
    const summaryCache = new Map();
    const commentsCache = new Map();
    let currentProfile = null;

    const REACTIONS = [
        { type: 'like', emoji: '👍', label: '点赞' },
        { type: 'happy', emoji: '😄', label: '开心' },
        { type: 'surprised', emoji: '😮', label: '惊讶' },
        { type: 'sad', emoji: '😢', label: '悲伤' },
        { type: 'angry', emoji: '😠', label: '愤怒' }
    ];
    const FAVORITE_TYPE = 'favorite';

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const escapeAttr = (value) => escapeHtml(value).replace(/`/g, '&#96;');
    const normalizeKey = (value) => String(value || '').trim();
    const getTables = () => window.ClassRecordSupabase?.getConfig().tables || {};
    const emptySummary = (recordKey) => ({ recordKey, favoriteCount: 0, commentCount: 0, myFavorited: false, reactions: {} });
    const getRecordElements = (container) => Array.from(container?.querySelectorAll('.record[data-record-key]') || []);

    const getProfile = async () => {
        if (currentProfile) return currentProfile;
        currentProfile = await window.ClassRecordSupabase.getProfile().catch(() => null) || {};
        return currentProfile;
    };

    const getSession = async () => window.ClassRecordSupabase.getSession();

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
            const rows = await query(items.slice(i, i + chunkSize));
            output.push(...rows);
        }
        return output;
    };

    const normalizeSummaryRows = (keys, rows, userId) => {
        const summaries = new Map(keys.map((key) => [key, emptySummary(key)]));
        rows.forEach((row) => {
            const key = row.record_key || row.recordKey;
            const item = summaries.get(key);
            if (!item) return;
            if (row.type === FAVORITE_TYPE) {
                item.favoriteCount += 1;
                item.myFavorited = item.myFavorited || row.user_id === userId;
                return;
            }
            const meta = REACTIONS.find((reaction) => reaction.type === row.type);
            if (!meta) return;
            const reaction = item.reactions[row.type] || { type: row.type, emoji: meta.emoji, label: meta.label, count: 0, mine: false };
            reaction.count += 1;
            reaction.mine = reaction.mine || row.user_id === userId;
            item.reactions[row.type] = reaction;
        });
        return summaries;
    };

    const loadSummaries = async (recordKeys) => {
        const keys = Array.from(new Set(recordKeys.map(normalizeKey).filter(Boolean)));
        if (!keys.length || !window.ClassRecordSupabase?.isConfigured()) return new Map();
        const client = await window.ClassRecordSupabase.getClient();
        const session = await getSession();
        const userId = session?.user?.id;
        const rows = await queryChunks(keys, async (chunk) => {
            const { data, error } = await client
                .from(getTables().reactions)
                .select('record_key,type,user_id')
                .in('record_key', chunk);
            if (error) throw error;
            return data || [];
        });
        const summaries = normalizeSummaryRows(keys, rows, userId);
        const comments = await queryChunks(keys, async (chunk) => {
            const { data, error } = await client
                .from(getTables().comments)
                .select('record_key')
                .in('record_key', chunk);
            if (error) throw error;
            return data || [];
        });
        comments.forEach((row) => {
            const item = summaries.get(row.record_key);
            if (item) item.commentCount += 1;
        });
        summaries.forEach((value, key) => summaryCache.set(key, value));
        return summaries;
    };

    const renderReactionPicker = (recordEl, summary) => {
        recordEl.querySelector('.record-reaction-popover')?.remove();
        const missing = REACTIONS.filter((reaction) => !summary.reactions[reaction.type]?.count && !summary.reactions[reaction.type]?.mine);
        if (!missing.length) return;
        const popover = document.createElement('div');
        popover.className = 'record-reaction-popover';
        popover.innerHTML = missing.map((reaction) => `
            <button type="button" class="record-social-btn" data-action="toggle-reaction" data-type="${escapeAttr(reaction.type)}" aria-label="${escapeAttr(reaction.label)}">
                <span class="record-social-emoji" aria-hidden="true">${reaction.emoji}</span>
                <span>${escapeHtml(reaction.label)}</span>
            </button>
        `).join('');
        recordEl.querySelector('.record-social-actions')?.appendChild(popover);
    };

    const renderSummary = (recordEl, summary) => {
        const actions = recordEl.querySelector('.record-social-actions');
        if (!actions) return;
        actions.querySelectorAll('[data-generated-reaction="true"], .record-reaction-add').forEach((el) => el.remove());
        REACTIONS.forEach((reaction) => {
            const item = summary.reactions[reaction.type];
            if (!item?.count && !item?.mine) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `record-social-btn${item.mine ? ' is-active' : ''}`;
            button.dataset.action = 'toggle-reaction';
            button.dataset.type = reaction.type;
            button.dataset.generatedReaction = 'true';
            button.setAttribute('aria-label', reaction.label);
            button.setAttribute('aria-pressed', String(Boolean(item.mine)));
            button.innerHTML = `<span class="record-social-emoji" aria-hidden="true">${reaction.emoji}</span><strong>${item.count}</strong>`;
            actions.prepend(button);
        });
        if (REACTIONS.some((reaction) => !summary.reactions[reaction.type]?.count && !summary.reactions[reaction.type]?.mine)) {
            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'record-social-btn record-reaction-add';
            add.dataset.action = 'show-reaction-picker';
            add.setAttribute('aria-label', '添加情绪反应');
            add.textContent = '☺+';
            const favoriteButton = actions.querySelector('[data-action="toggle-favorite"]');
            actions.insertBefore(add, favoriteButton || actions.firstChild);
        }
        const favoriteBtn = recordEl.querySelector('[data-action="toggle-favorite"]');
        const commentBtn = recordEl.querySelector('[data-action="toggle-comments"]');
        if (favoriteBtn) {
            favoriteBtn.classList.toggle('is-active', summary.myFavorited);
            favoriteBtn.setAttribute('aria-pressed', String(summary.myFavorited));
            favoriteBtn.querySelector('.record-social-emoji').textContent = summary.myFavorited ? '⭐' : '☆';
            favoriteBtn.querySelector('strong').textContent = String(summary.favoriteCount);
        }
        if (commentBtn) commentBtn.querySelector('strong').textContent = String(summary.commentCount);
    };

    const showStatus = (recordEl, message, tone = 'info') => {
        const status = recordEl.querySelector('.record-social-status');
        if (!status) return;
        status.textContent = message || '';
        status.dataset.tone = tone;
        window.clearTimeout(status._clearTimer);
        if (message) status._clearTimer = window.setTimeout(() => { status.textContent = ''; status.dataset.tone = ''; }, 1600);
    };

    const renderError = (recordEl, message) => showStatus(recordEl, message || '互动操作失败，请稍后再试。', 'error');

    const loadCommentLikes = async (commentIds, userId) => {
        if (!commentIds.length) return new Map();
        const client = await window.ClassRecordSupabase.getClient();
        const table = getTables().commentLikes || 'comment_likes';
        const { data, error } = await client.from(table).select('comment_id,user_id').in('comment_id', commentIds);
        if (error) throw error;
        const map = new Map(commentIds.map((id) => [id, { count: 0, mine: false }]));
        (data || []).forEach((row) => {
            const item = map.get(row.comment_id);
            if (!item) return;
            item.count += 1;
            item.mine = item.mine || row.user_id === userId;
        });
        return map;
    };

    const renderComments = async (comments, userId) => {
        if (!comments.length) return '<div class="record-comment-empty">暂无评论。</div>';
        const likes = await loadCommentLikes(comments.map((comment) => comment.id), userId).catch(() => new Map());
        return comments.map((comment) => {
            const canDelete = comment.user_id === userId;
            const like = likes.get(comment.id) || { count: 0, mine: false };
            return `
                <article class="record-comment" data-comment-id="${escapeAttr(comment.id)}">
                    <div class="record-comment-meta"><strong>${escapeHtml(comment.author_name || '同学')}</strong><span>${escapeHtml(formatTime(comment.created_at))}</span></div>
                    <p>${escapeHtml(comment.body)}</p>
                    <div class="record-comment-actions">
                        <button type="button" class="record-comment-like${like.mine ? ' is-active' : ''}" data-action="toggle-comment-like" aria-pressed="${String(like.mine)}">👍 <strong>${like.count}</strong></button>
                        ${canDelete ? '<button type="button" class="record-comment-delete" data-action="delete-comment">删除</button>' : ''}
                    </div>
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
        listEl.innerHTML = '<div class="record-comment-empty">评论加载中...</div>';
        const session = await getSession();
        const comments = await loadComments(recordKey, { force });
        listEl.innerHTML = await renderComments(comments, session?.user?.id);
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

    const toggleTypedReaction = async (recordEl, type) => {
        const key = normalizeKey(recordEl.dataset.recordKey);
        const actionKey = `${key}:${type}`;
        if (pendingActions.has(actionKey)) return;
        pendingActions.add(actionKey);
        const client = await window.ClassRecordSupabase.getClient();
        const session = await getSession();
        const userId = session?.user?.id;
        const summary = summaryCache.get(key) || emptySummary(key);
        const active = Boolean(summary.reactions[type]?.mine);
        try {
            if (active) {
                const { error } = await client.from(getTables().reactions).delete().eq('record_key', key).eq('type', type).eq('user_id', userId);
                if (error) throw error;
            } else {
                const { error } = await client.from(getTables().reactions).upsert({ record_key: key, type, user_id: userId }, { onConflict: 'record_key,user_id,type' });
                if (error) throw error;
            }
            recordEl.querySelector('.record-reaction-popover')?.remove();
            await refreshRecordSummary(recordEl);
        } finally {
            pendingActions.delete(actionKey);
        }
    };

    const toggleFavorite = async (recordEl) => {
        const key = normalizeKey(recordEl.dataset.recordKey);
        const actionKey = `${key}:${FAVORITE_TYPE}`;
        if (pendingActions.has(actionKey)) return;
        pendingActions.add(actionKey);
        const client = await window.ClassRecordSupabase.getClient();
        const session = await getSession();
        const userId = session?.user?.id;
        const summary = summaryCache.get(key) || emptySummary(key);
        const active = summary.myFavorited;
        try {
            if (active) {
                const { error } = await client.from(getTables().reactions).delete().eq('record_key', key).eq('type', FAVORITE_TYPE).eq('user_id', userId);
                if (error) throw error;
            } else {
                const { error } = await client.from(getTables().reactions).upsert({ record_key: key, type: FAVORITE_TYPE, user_id: userId }, { onConflict: 'record_key,user_id,type' });
                if (error) throw error;
            }
            window.dispatchEvent(new CustomEvent('recordfavoritechange', { detail: { recordKey: key, favorited: !active } }));
            showStatus(recordEl, active ? '已取消收藏' : '已收藏', active ? 'info' : 'success');
            await refreshRecordSummary(recordEl);
        } finally {
            pendingActions.delete(actionKey);
        }
    };

    const toggleCommentLike = async (recordEl, commentEl) => {
        const commentId = commentEl?.dataset.commentId;
        if (!commentId) return;
        const actionKey = `comment:${commentId}`;
        if (pendingActions.has(actionKey)) return;
        pendingActions.add(actionKey);
        const client = await window.ClassRecordSupabase.getClient();
        const session = await getSession();
        const userId = session?.user?.id;
        const table = getTables().commentLikes || 'comment_likes';
        const button = commentEl.querySelector('[data-action="toggle-comment-like"]');
        const active = button?.classList.contains('is-active');
        try {
            if (active) {
                const { error } = await client.from(table).delete().eq('comment_id', commentId).eq('user_id', userId);
                if (error) throw error;
            } else {
                const { error } = await client.from(table).upsert({ comment_id: commentId, user_id: userId }, { onConflict: 'comment_id,user_id' });
                if (error) throw error;
            }
            await renderCommentList(recordEl, { force: true });
        } finally {
            pendingActions.delete(actionKey);
        }
    };

    const shareRecord = async (recordEl) => {
        const anchor = recordEl.id ? `#${recordEl.id}` : '';
        const url = `${location.origin}${location.pathname}${location.search}${anchor}`;
        if (navigator.share) {
            await navigator.share({ title: '编日史记录', url }).catch((error) => {
                if (error?.name !== 'AbortError') throw error;
            });
            return;
        }
        await navigator.clipboard.writeText(url);
        showStatus(recordEl, '链接已复制。', 'success');
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
            const session = await getSession();
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
        if (!commentId || !window.confirm('确定删除这条评论吗？')) return;
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
                if (button.dataset.action === 'show-reaction-picker') {
                    renderReactionPicker(recordEl, summaryCache.get(normalizeKey(recordEl.dataset.recordKey)) || emptySummary(normalizeKey(recordEl.dataset.recordKey)));
                    return;
                }
                if (button.dataset.action === 'toggle-reaction') {
                    await toggleTypedReaction(recordEl, button.dataset.type);
                    return;
                }
                if (button.dataset.action === 'toggle-favorite') {
                    await toggleFavorite(recordEl);
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
                    return;
                }
                if (button.dataset.action === 'toggle-comment-like') {
                    await toggleCommentLike(recordEl, button.closest('.record-comment'));
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
        const session = await getSession();
        const { data, error } = await client
            .from(getTables().reactions)
            .select('record_key')
            .eq('type', FAVORITE_TYPE)
            .eq('user_id', session?.user?.id);
        if (error) throw error;
        return new Set((data || []).map((row) => row.record_key));
    };

    window.RecordInteractions = { hydrate, refreshRecord: refreshRecordSummary, getFavoriteKeys };
})();
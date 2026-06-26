/************************************************************
 * recordInteractions.js
 * Supabase 记录互动：情绪态度、收藏、分享、评论、评论点赞
 ************************************************************/

(() => {
    const MAX_COMMENT_LENGTH = 500;
    const EMOTIONS = [
        { type: 'like', icon: '👍', label: '点赞' },
        { type: 'happy', icon: '😄', label: '开心' },
        { type: 'surprised', icon: '😮', label: '惊讶' },
        { type: 'sad', icon: '😢', label: '悲伤' },
        { type: 'angry', icon: '😡', label: '愤怒' }
    ];
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
    const emptySummary = (recordKey) => ({
        recordKey,
        favoriteCount: 0,
        commentCount: 0,
        myFavorited: false,
        emotionCounts: Object.fromEntries(EMOTIONS.map((item) => [item.type, 0])),
        myEmotions: new Set()
    });
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
            const rows = await query(items.slice(i, i + chunkSize));
            output.push(...rows);
        }
        return output;
    };

    const loadSummaries = async (recordKeys) => {
        const keys = Array.from(new Set(recordKeys.map(normalizeKey).filter(Boolean)));
        if (!keys.length || !window.ClassRecordSupabase?.isConfigured()) return new Map();
        const client = await window.ClassRecordSupabase.getClient();
        const session = await window.ClassRecordSupabase.getSession();
        const userId = session?.user?.id;
        const tables = getTables();
        const summaries = new Map(keys.map((key) => [key, emptySummary(key)]));
        const validTypes = new Set([...EMOTIONS.map((item) => item.type), 'favorite']);

        const reactions = await queryChunks(keys, async (chunk) => {
            const { data, error } = await client
                .from(tables.reactions)
                .select('record_key,type,user_id')
                .in('record_key', chunk);
            if (error) throw error;
            return data || [];
        });

        reactions.forEach((row) => {
            const type = String(row.type || '');
            if (!validTypes.has(type)) return;
            const item = summaries.get(row.record_key);
            if (!item) return;
            if (type === 'favorite') {
                item.favoriteCount += 1;
                item.myFavorited = item.myFavorited || row.user_id === userId;
                return;
            }
            item.emotionCounts[type] = (item.emotionCounts[type] || 0) + 1;
            if (row.user_id === userId) item.myEmotions.add(type);
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

        summaries.forEach((value, key) => summaryCache.set(key, value));
        return summaries;
    };

    const renderEmotionButton = (emotion, summary, source) => {
        const count = Number(summary.emotionCounts[emotion.type]) || 0;
        const active = summary.myEmotions.has(emotion.type);
        return `
            <button type="button" class="record-social-btn record-emotion-btn${active ? ' is-active' : ''}" data-action="toggle-reaction" data-type="${escapeAttr(emotion.type)}" aria-label="${escapeAttr(emotion.label)}" aria-pressed="${active}">
                <span class="record-social-emoji" aria-hidden="true">${emotion.icon}</span><strong>${source === 'popover' ? emotion.label : count}</strong>
            </button>
        `;
    };

    const renderSummary = (recordEl, summary) => {
        const favoriteBtn = recordEl.querySelector('[data-action="toggle-reaction"][data-type="favorite"]');
        const commentBtn = recordEl.querySelector('[data-action="toggle-comments"]');
        const group = recordEl.querySelector('[data-emotion-group]');
        const popover = recordEl.querySelector('[data-emotion-popover]');
        const moreBtn = recordEl.querySelector('[data-action="open-emotions"]');
        const visible = EMOTIONS.filter((emotion) => (summary.emotionCounts[emotion.type] || 0) > 0 || summary.myEmotions.has(emotion.type));
        const hidden = EMOTIONS.filter((emotion) => !visible.some((item) => item.type === emotion.type));
        if (group) {
            group.innerHTML = visible.map((emotion) => renderEmotionButton(emotion, summary, 'inline')).join('');
        }
        if (popover) {
            popover.innerHTML = hidden.length
                ? hidden.map((emotion) => renderEmotionButton(emotion, summary, 'popover')).join('')
                : '<span class="record-comment-empty">所有情绪都已显示。</span>';
        }
        if (moreBtn) {
            moreBtn.hidden = hidden.length === 0;
            moreBtn.setAttribute('aria-expanded', String(popover && !popover.hidden));
        }
        if (favoriteBtn) {
            favoriteBtn.classList.toggle('is-active', summary.myFavorited);
            favoriteBtn.setAttribute('aria-pressed', String(summary.myFavorited));
            favoriteBtn.querySelector('.record-social-emoji').textContent = summary.myFavorited ? '⭐' : '☆';
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

    const renderError = (recordEl, message) => showStatus(recordEl, message || '互动操作失败，请稍后再试。', 'error');

    const loadCommentLikes = async (comments, userId) => {
        const table = getTables().commentLikes || 'record_comment_likes';
        const ids = comments.map((comment) => comment.id).filter(Boolean);
        const stats = new Map(ids.map((id) => [id, { count: 0, mine: false }]));
        if (!ids.length) return stats;
        try {
            const client = await window.ClassRecordSupabase.getClient();
            const { data, error } = await client.from(table).select('comment_id,user_id').in('comment_id', ids);
            if (error) throw error;
            (data || []).forEach((row) => {
                const item = stats.get(row.comment_id);
                if (!item) return;
                item.count += 1;
                item.mine = item.mine || row.user_id === userId;
            });
        } catch (error) {
            console.warn('评论点赞加载失败：', error);
        }
        return stats;
    };

    const renderComments = async (comments, userId) => {
        if (!comments.length) return '<div class="record-comment-empty">暂无评论。</div>';
        const likeStats = await loadCommentLikes(comments, userId);
        return comments.map((comment) => {
            const canDelete = comment.user_id === userId;
            const stat = likeStats.get(comment.id) || { count: 0, mine: false };
            return `
                <article class="record-comment" data-comment-id="${escapeAttr(comment.id)}">
                    <div class="record-comment-meta"><strong>${escapeHtml(comment.author_name || '同学')}</strong><span>${escapeHtml(formatTime(comment.created_at))}</span></div>
                    <p>${escapeHtml(comment.body)}</p>
                    <div class="record-comment-actions">
                        <button type="button" class="record-comment-like${stat.mine ? ' is-active' : ''}" data-action="toggle-comment-like" aria-pressed="${stat.mine}">👍 <strong>${stat.count}</strong></button>
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
        listEl.innerHTML = '<div class="record-comment-empty">评论加载中…</div>';
        const session = await window.ClassRecordSupabase.getSession();
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

    const toggleReaction = async (recordEl, type) => {
        const key = normalizeKey(recordEl.dataset.recordKey);
        const actionKey = `${key}:${type}`;
        if (pendingActions.has(actionKey)) return;
        pendingActions.add(actionKey);
        const client = await window.ClassRecordSupabase.getClient();
        const session = await window.ClassRecordSupabase.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('请先登录。');
        const tables = getTables();
        const summary = summaryCache.get(key) || emptySummary(key);
        const isFavorite = type === 'favorite';
        const active = isFavorite ? summary.myFavorited : summary.myEmotions.has(type);
        const optimistic = {
            ...summary,
            emotionCounts: { ...summary.emotionCounts },
            myEmotions: new Set(summary.myEmotions)
        };
        if (isFavorite) {
            optimistic.myFavorited = !active;
            optimistic.favoriteCount = Math.max(0, optimistic.favoriteCount + (active ? -1 : 1));
        } else {
            if (active) optimistic.myEmotions.delete(type);
            else optimistic.myEmotions.add(type);
            optimistic.emotionCounts[type] = Math.max(0, (optimistic.emotionCounts[type] || 0) + (active ? -1 : 1));
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
            if (isFavorite) {
                window.dispatchEvent(new CustomEvent('recordfavoritechange', { detail: { recordKey: key, favorited: !active } }));
            }
            showStatus(recordEl, active ? '已取消。' : '已记录。', active ? 'info' : 'success');
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
            try {
                await navigator.share({ title: '编日史记录', url });
                showStatus(recordEl, '分享已打开。', 'success');
                return;
            } catch (error) {
                if (error?.name === 'AbortError') return;
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            showStatus(recordEl, '链接已复制。', 'success');
        } catch (error) {
            showStatus(recordEl, `复制失败，请手动复制：${url}`, 'error');
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
            const userId = session?.user?.id;
            if (!userId) throw new Error('请先登录。');
            const profile = await getProfile();
            const recordKey = normalizeKey(recordEl.dataset.recordKey);
            const { error } = await client.from(getTables().comments).insert({
                record_key: recordKey,
                user_id: userId,
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
        if (!window.confirm('确定删除这条评论吗？')) return;
        const client = await window.ClassRecordSupabase.getClient();
        const { error } = await client.from(getTables().comments).delete().eq('id', commentId);
        if (error) throw error;
        commentsCache.delete(normalizeKey(recordEl.dataset.recordKey));
        await renderCommentList(recordEl, { force: true });
    };

    const toggleCommentLike = async (recordEl, commentId) => {
        if (!commentId) return;
        const client = await window.ClassRecordSupabase.getClient();
        const session = await window.ClassRecordSupabase.getSession();
        const userId = session?.user?.id;
        if (!userId) throw new Error('请先登录。');
        const table = getTables().commentLikes || 'record_comment_likes';
        const button = recordEl.querySelector(`.record-comment[data-comment-id="${CSS.escape(commentId)}"] [data-action="toggle-comment-like"]`);
        const active = button?.classList.contains('is-active');
        if (active) {
            const { error } = await client.from(table).delete().eq('comment_id', commentId).eq('user_id', userId);
            if (error) throw error;
        } else {
            const { error } = await client.from(table).upsert({ comment_id: commentId, user_id: userId }, { onConflict: 'comment_id,user_id' });
            if (error) throw error;
        }
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
                    recordEl.querySelector('[data-emotion-popover]')?.setAttribute('hidden', '');
                    return;
                }
                if (button.dataset.action === 'open-emotions') {
                    const popover = recordEl.querySelector('[data-emotion-popover]');
                    if (!popover) return;
                    popover.hidden = !popover.hidden;
                    button.setAttribute('aria-expanded', String(!popover.hidden));
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
                    await toggleCommentLike(recordEl, button.closest('.record-comment')?.dataset.commentId);
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
        const keys = records?.map((record) => record.fileName || record.id) || recordEls.map((el) => el.dataset.recordKey);
        if (!window.ClassRecordSupabase?.isConfigured()) {
            recordEls.forEach((el) => renderSummary(el, emptySummary(el.dataset.recordKey)));
            return;
        }
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

    window.RecordInteractions = { hydrate, refreshRecord: refreshRecordSummary, getFavoriteKeys, emotions: EMOTIONS };
})();

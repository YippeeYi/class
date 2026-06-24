/************************************************************
 * authControls.js
 * 顶部账号面板：资料、改密、退出登录
 ************************************************************/

(() => {
    const accountBtn = document.getElementById('clear-access-btn');
    if (!accountBtn) {
        return;
    }

    let panel = null;
    let profile = null;

    const escapeHtml = (value) => String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const setStatus = (message, tone = '') => {
        const status = panel?.querySelector('.account-panel-status');
        if (!status) return;
        status.textContent = message || '';
        status.dataset.tone = tone;
    };

    const loadProfile = async () => {
        if (profile) return profile;
        if (!window.ClassRecordSupabase?.isConfigured()) {
            profile = { displayName: '同学', username: '' };
            return profile;
        }
        profile = await window.ClassRecordSupabase.getProfile().catch(() => null) || { displayName: '同学', username: '' };
        return profile;
    };

    const closePanel = () => {
        panel?.remove();
        panel = null;
        accountBtn.setAttribute('aria-expanded', 'false');
    };

    const positionPanel = () => {
        if (!panel) return;
        const rect = accountBtn.getBoundingClientRect();
        const gap = 8;
        panel.style.top = `${rect.bottom + gap + window.scrollY}px`;
        panel.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
    };

    const renderPanel = async () => {
        const item = await loadProfile();
        closePanel();
        panel = document.createElement('section');
        panel.className = 'account-panel';
        panel.setAttribute('aria-label', '账号设置');
        panel.innerHTML = `
            <header class="account-panel-head">
                <strong>${escapeHtml(item.displayName || item.username || '同学')}</strong>
                <span>${escapeHtml(item.email || '')}</span>
            </header>
            <form class="account-profile-form">
                <label>
                    <span>显示名</span>
                    <input name="displayName" type="text" maxlength="32" value="${escapeHtml(item.displayName || '')}" autocomplete="nickname">
                </label>
                <button type="submit" class="btn-action">保存资料</button>
            </form>
            <form class="account-password-form">
                <label>
                    <span>新密码</span>
                    <input name="password" type="password" minlength="6" autocomplete="new-password" required>
                </label>
                <label>
                    <span>确认新密码</span>
                    <input name="passwordConfirm" type="password" minlength="6" autocomplete="new-password" required>
                </label>
                <button type="submit" class="btn-action">修改密码</button>
            </form>
            <div class="account-panel-actions">
                <button type="button" class="btn-action account-signout">退出登录</button>
            </div>
            <p class="account-panel-status" aria-live="polite"></p>
        `;
        document.body.appendChild(panel);
        accountBtn.setAttribute('aria-expanded', 'true');
        positionPanel();
        bindPanelEvents();
    };

    const setFormBusy = (form, busy) => {
        form.querySelectorAll('input, button').forEach((el) => {
            el.disabled = busy;
        });
    };

    const bindPanelEvents = () => {
        const profileForm = panel.querySelector('.account-profile-form');
        const passwordForm = panel.querySelector('.account-password-form');
        const signoutBtn = panel.querySelector('.account-signout');

        profileForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!window.ClassRecordSupabase?.isConfigured()) {
                setStatus('Supabase 尚未配置，无法保存资料。', 'error');
                return;
            }
            const displayName = profileForm.displayName.value.trim();
            setFormBusy(profileForm, true);
            try {
                profile = await window.ClassRecordSupabase.upsertProfile({
                    username: profile?.username,
                    displayName
                });
                profile.displayName = displayName || profile.username || '同学';
                setStatus('资料已保存。', 'success');
            } catch (error) {
                console.warn('保存资料失败：', error);
                setStatus('资料保存失败，请检查 profiles 表权限。', 'error');
            } finally {
                setFormBusy(profileForm, false);
            }
        });

        passwordForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const password = passwordForm.password.value;
            const passwordConfirm = passwordForm.passwordConfirm.value;
            if (password.length < 6) {
                setStatus('新密码至少需要 6 位。', 'error');
                return;
            }
            if (password !== passwordConfirm) {
                setStatus('两次输入的新密码不一致。', 'error');
                return;
            }
            setFormBusy(passwordForm, true);
            try {
                await window.changeCurrentPassword(password);
                passwordForm.reset();
                setStatus('密码已修改，下次登录请使用新密码。', 'success');
            } catch (error) {
                console.warn('修改密码失败：', error);
                setStatus(error?.message || '密码修改失败。', 'error');
            } finally {
                setFormBusy(passwordForm, false);
            }
        });

        signoutBtn?.addEventListener('click', async () => {
            const confirmed = window.confirm('确定要退出当前账号吗？');
            if (!confirmed) return;
            signoutBtn.disabled = true;
            await window.clearAccessKey?.();
            if (typeof window.clearCache === 'function') {
                await window.clearCache();
            }
            window.location.replace('auth.html');
        });
    };

    accountBtn.type = 'button';
    accountBtn.setAttribute('aria-haspopup', 'dialog');
    accountBtn.setAttribute('aria-expanded', 'false');
    accountBtn.addEventListener('click', async () => {
        if (panel) {
            closePanel();
            return;
        }
        await renderPanel();
    });

    document.addEventListener('click', (event) => {
        if (!panel) return;
        if (panel.contains(event.target) || accountBtn.contains(event.target)) return;
        closePanel();
    });

    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, { passive: true });
})();

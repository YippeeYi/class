(() => {
    const accountBtn = document.getElementById('clear-access-btn');
    if (!accountBtn) return;

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
            profile = { displayName: 'Student', nickname: 'Student', username: '' };
            return profile;
        }
        profile = await window.ClassRecordSupabase.getProfile().catch(() => null) || { displayName: 'Student', nickname: 'Student', username: '' };
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
        panel.style.top = `${rect.bottom + 8 + window.scrollY}px`;
        panel.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
    };

    const renderPanel = async () => {
        const item = await loadProfile();
        closePanel();
        panel = document.createElement('section');
        panel.className = 'account-panel';
        panel.setAttribute('aria-label', 'Account settings');
        panel.innerHTML = `
            <header class="account-panel-head">
                <strong>${escapeHtml(item.nickname || item.displayName || item.username || 'Student')}</strong>
                <span>${escapeHtml(item.email || '')}</span>
            </header>
            <form class="account-profile-form">
                <label>
                    <span>Nickname</span>
                    <input name="displayName" type="text" maxlength="32" value="${escapeHtml(item.nickname || item.displayName || '')}" autocomplete="nickname">
                </label>
                <label>
                    <span>Avatar URL</span>
                    <input name="avatarUrl" type="url" maxlength="500" value="${escapeHtml(item.avatarUrl || '')}" autocomplete="photo">
                </label>
                <button type="submit" class="btn-action">Save profile</button>
            </form>
            <form class="account-password-form">
                <label>
                    <span>New password</span>
                    <input name="password" type="password" minlength="6" autocomplete="new-password" required>
                </label>
                <label>
                    <span>Confirm password</span>
                    <input name="passwordConfirm" type="password" minlength="6" autocomplete="new-password" required>
                </label>
                <button type="submit" class="btn-action">Change password</button>
            </form>
            <div class="account-panel-actions">
                <button type="button" class="btn-action account-signout">Sign out</button>
            </div>
            <p class="account-panel-status" aria-live="polite"></p>
        `;
        document.body.appendChild(panel);
        accountBtn.setAttribute('aria-expanded', 'true');
        positionPanel();
        bindPanelEvents();
    };

    const setFormBusy = (form, busy) => {
        form.querySelectorAll('input, button').forEach((el) => { el.disabled = busy; });
    };

    const bindPanelEvents = () => {
        const profileForm = panel.querySelector('.account-profile-form');
        const passwordForm = panel.querySelector('.account-password-form');
        const signoutBtn = panel.querySelector('.account-signout');

        profileForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!window.ClassRecordSupabase?.isConfigured()) {
                setStatus('Supabase is not configured.', 'error');
                return;
            }
            const displayName = profileForm.displayName.value.trim();
            const avatarUrl = profileForm.avatarUrl?.value.trim() || '';
            setFormBusy(profileForm, true);
            try {
                profile = await window.ClassRecordSupabase.upsertProfile({
                    username: profile?.username,
                    displayName,
                    nickname: displayName,
                    avatarUrl
                });
                profile.displayName = displayName || profile.username || 'Student';
                profile.nickname = profile.displayName;
                profile.avatarUrl = avatarUrl;
                setStatus('Profile saved.', 'success');
            } catch (error) {
                console.warn('Profile save failed:', error);
                setStatus('Profile save failed.', 'error');
            } finally {
                setFormBusy(profileForm, false);
            }
        });

        passwordForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const password = passwordForm.password.value;
            const passwordConfirm = passwordForm.passwordConfirm.value;
            if (password.length < 6) {
                setStatus('Password needs at least 6 characters.', 'error');
                return;
            }
            if (password !== passwordConfirm) {
                setStatus('Passwords do not match.', 'error');
                return;
            }
            setFormBusy(passwordForm, true);
            try {
                await window.changeCurrentPassword(password);
                passwordForm.reset();
                setStatus('Password updated.', 'success');
            } catch (error) {
                console.warn('Password update failed:', error);
                setStatus(error?.message || 'Password update failed.', 'error');
            } finally {
                setFormBusy(passwordForm, false);
            }
        });

        signoutBtn?.addEventListener('click', async () => {
            const confirmed = window.confirm('Sign out of this account?');
            if (!confirmed) return;
            signoutBtn.disabled = true;
            await window.clearAccessKey?.();
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
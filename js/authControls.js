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

    const loadClaimedPerson = async () => {
        if (!window.ClassRecordSupabase?.isConfigured()) return null;
        const client = await window.ClassRecordSupabase.getClient();
        const session = await window.ClassRecordSupabase.getSession();
        const userId = session?.user?.id;
        if (!userId) return null;
        const { data, error } = await client
            .from(window.ClassRecordSupabase.getConfig().tables.people)
            .select('id,person_id,name,display_name,aliases,bio,avatar_url,claimed_by')
            .eq('claimed_by', userId)
            .maybeSingle();
        if (error) {
            console.warn('Claimed person load failed:', error);
            return null;
        }
        return data ? {
            id: data.person_id || data.id,
            name: data.display_name || data.name || data.person_id || data.id,
            aliases: Array.isArray(data.aliases) ? data.aliases.join('、') : '',
            bio: data.bio || '',
            avatarUrl: data.avatar_url || ''
        } : null;
    };

    const loadPeopleOptions = async () => {
        const list = typeof window.loadAllPeople === 'function' ? await window.loadAllPeople().catch(() => []) : [];
        return list.map((person) => ({
            id: person.id,
            name: person.name || person.displayName || person.id
        })).filter((person) => person.id);
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
        const [item, claimedPerson, peopleOptions] = await Promise.all([
            loadProfile(),
            loadClaimedPerson(),
            loadPeopleOptions()
        ]);
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
                    <small>头像请使用正方形图片；个人页会以正方形容器展示。</small>
                </label>
                <button type="submit" class="btn-action">Save profile</button>
            </form>
            <section class="account-claim-section" data-claimed-person="${escapeHtml(claimedPerson?.id || '')}">
                <strong>人物资料</strong>
                <p>${claimedPerson ? `已认领：${escapeHtml(claimedPerson.name || claimedPerson.id)}` : '当前账号尚未认领人物。'}</p>
                <div class="account-panel-actions">
                    ${claimedPerson ? `<button type="button" class="btn-action account-edit-person">编辑</button><button type="button" class="btn-action account-open-person">个人页</button>` : '<button type="button" class="btn-action account-claim-person">认领</button>'}
                </div>
                <form class="account-claim-form" hidden>
                    <label>
                        <span>选择人物</span>
                        <select name="personId" required>
                            <option value="">请选择</option>
                            ${peopleOptions.map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}（${escapeHtml(person.id)}）</option>`).join('')}
                        </select>
                    </label>
                    <label><span>认领说明</span><textarea name="note" rows="3" placeholder="请说明为什么这是你的资料"></textarea></label>
                    <button type="submit" class="btn-action">提交审核</button>
                </form>
                <form class="account-edit-person-form" hidden>
                    <label><span>显示名</span><input name="displayName" type="text" maxlength="80" value="${escapeHtml(claimedPerson?.name || '')}"></label>
                    <label><span>别名</span><input name="alias" type="text" maxlength="200" value="${escapeHtml(claimedPerson?.aliases || '')}"></label>
                    <label><span>简介</span><textarea name="bio" rows="4">${escapeHtml(claimedPerson?.bio || '')}</textarea></label>
                    <label><span>头像 URL</span><input name="avatarUrl" type="url" maxlength="500" value="${escapeHtml(claimedPerson?.avatarUrl || '')}"><small>头像修改随资料编辑进入管理员审核。</small></label>
                    <button type="submit" class="btn-action">提交审核</button>
                </form>
            </section>
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
        const claimSection = panel.querySelector('.account-claim-section');
        const claimForm = panel.querySelector('.account-claim-form');
        const editPersonForm = panel.querySelector('.account-edit-person-form');
        const claimedPersonId = claimSection?.dataset.claimedPerson || '';

        panel.querySelector('.account-claim-person')?.addEventListener('click', () => {
            claimForm.hidden = !claimForm.hidden;
            if (editPersonForm) editPersonForm.hidden = true;
        });

        panel.querySelector('.account-edit-person')?.addEventListener('click', () => {
            editPersonForm.hidden = !editPersonForm.hidden;
            if (claimForm) claimForm.hidden = true;
        });

        panel.querySelector('.account-open-person')?.addEventListener('click', () => {
            if (!claimedPersonId) return;
            window.navigateTo ? window.navigateTo(`person.html?id=${encodeURIComponent(claimedPersonId)}`) : location.href = `person.html?id=${encodeURIComponent(claimedPersonId)}`;
        });

        claimForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!window.ReviewSystem?.submitPersonClaim) {
                setStatus('审核系统尚未加载。', 'error');
                return;
            }
            setFormBusy(claimForm, true);
            try {
                await window.ReviewSystem.submitPersonClaim({
                    personId: claimForm.personId.value,
                    note: claimForm.note.value.trim()
                });
                claimForm.reset();
                claimForm.hidden = true;
                setStatus('认领申请已提交管理员审核。', 'success');
            } catch (error) {
                console.warn('Person claim failed:', error);
                setStatus('认领申请提交失败。', 'error');
            } finally {
                setFormBusy(claimForm, false);
            }
        });

        editPersonForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!claimedPersonId || !window.ReviewSystem?.submitPersonEdit) {
                setStatus('审核系统尚未加载。', 'error');
                return;
            }
            setFormBusy(editPersonForm, true);
            try {
                await window.ReviewSystem.submitPersonEdit({
                    personId: claimedPersonId,
                    displayName: editPersonForm.displayName.value.trim(),
                    alias: editPersonForm.alias.value.trim(),
                    bio: editPersonForm.bio.value.trim(),
                    avatarUrl: editPersonForm.avatarUrl?.value.trim() || ''
                });
                editPersonForm.hidden = true;
                setStatus('资料编辑已提交管理员审核。', 'success');
            } catch (error) {
                console.warn('Person edit failed:', error);
                setStatus('资料编辑提交失败。', 'error');
            } finally {
                setFormBusy(editPersonForm, false);
            }
        });

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

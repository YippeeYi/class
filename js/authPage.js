/************************************************************
 * authPage.js
 * Supabase 登录页面逻辑
 ************************************************************/

(() => {
    const form = document.querySelector('.auth-form');
    const errorText = document.querySelector('.auth-error');
    const submitButton = form?.querySelector('button[type="submit"]');
    let hasFailedOnce = false;
    let submitting = false;

    if (!form) {
        return;
    }

    const setError = (message) => {
        if (!errorText) {
            return;
        }
        errorText.textContent = message || '';
        if (!message) {
            errorText.classList.remove('auth-error--emphasis');
            return;
        }
        if (hasFailedOnce) {
            errorText.classList.remove('auth-error--emphasis');
            void errorText.offsetWidth;
            errorText.classList.add('auth-error--emphasis');
        }
        hasFailedOnce = true;
    };

    const setSubmitting = (value) => {
        submitting = value;
        form.querySelectorAll('input, button').forEach((el) => {
            el.disabled = value;
        });
        if (submitButton) {
            submitButton.textContent = value ? '登录中…' : '登录';
        }
    };

    const showConfigError = (error) => {
        setError(error?.message || '认证服务暂不可用。');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = '等待配置';
        }
    };

    if (typeof window.getAuthReadyError === 'function' && window.getAuthReadyError()) {
        showConfigError(window.getAuthReadyError());
    }

    window.addEventListener('authGateError', (event) => {
        showConfigError(event.detail);
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submitting) {
            return;
        }
        const login = form.querySelector('input[name="login"]')?.value.trim();
        const password = form.querySelector('input[name="password"]')?.value;
        if (!login || !password) {
            setError('请输入账号和密码。');
            return;
        }
        if (typeof window.verifyAccessKey !== 'function') {
            setError('认证模块尚未加载完成，请稍后重试。');
            return;
        }

        setError('');
        setSubmitting(true);
        const result = await window.verifyAccessKey(login, password);
        setSubmitting(false);
        if (!result.ok) {
            setError(result.message || '登录失败。');
            return;
        }

        const target = sessionStorage.getItem('classRecordRedirectTarget') || 'index.html';
        sessionStorage.removeItem('classRecordRedirectTarget');
        window.location.replace(target);
    });
})();

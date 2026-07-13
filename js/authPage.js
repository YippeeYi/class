/************************************************************
 * authPage.js
 * 统一邀请码输入页
 ************************************************************/

(() => {
    const form = document.querySelector(".auth-form");
    const errorText = document.querySelector(".auth-error");
    const submitButton = form?.querySelector('button[type="submit"]');
    let hasFailedOnce = false;
    let submitting = false;

    if (!form) return;

    const setError = (message) => {
        if (!errorText) return;
        errorText.textContent = message || "";
        if (!message) {
            errorText.classList.remove("auth-error--emphasis");
            return;
        }
        if (hasFailedOnce) {
            errorText.classList.remove("auth-error--emphasis");
            void errorText.offsetWidth;
            errorText.classList.add("auth-error--emphasis");
        }
        hasFailedOnce = true;
    };

    const setSubmitting = (value) => {
        submitting = value;
        form.querySelectorAll("input, button").forEach((el) => {
            el.disabled = value;
        });
        if (submitButton) {
            submitButton.textContent = value ? "验证中..." : "进入";
        }
    };

    const showConfigError = (error) => {
        setError("验证服务暂不可用。");
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "等待配置";
        }
    };

    if (typeof window.getAuthReadyError === "function" && window.getAuthReadyError()) {
        showConfigError(window.getAuthReadyError());
    }

    window.addEventListener("authGateError", (event) => {
        showConfigError(event.detail);
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (submitting) return;
        const code = form.querySelector('input[name="inviteCode"]')?.value.trim();
        if (!code) {
            setError("请输入邀请码。");
            return;
        }
        if (typeof window.verifyInviteCode !== "function") {
            setError("验证模块尚未加载完成，请稍后重试。");
            return;
        }

        setError("");
        setSubmitting(true);
        const result = await window.verifyInviteCode(code);
        setSubmitting(false);
        if (!result.ok) {
            setError(result.message || "邀请码验证失败。");
            return;
        }

        const target = sessionStorage.getItem("classRecordRedirectTarget") || "index.html";
        sessionStorage.removeItem("classRecordRedirectTarget");
        window.location.replace(target);
    });
})();

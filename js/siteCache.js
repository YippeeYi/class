/**
 * 站点本地状态的唯一清理入口。
 * 访问权限被手动移除或因长期未访问而过期时，都必须调用这里。
 */
(() => {
    let clearingPromise = null;

    const isDevelopment = location.protocol === "file:"
        || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
    const report = (level, label, error, context = {}) => {
        const method = typeof console[level] === "function" ? level : "warn";
        const safe = {
            type: String(error?.name || "Error").slice(0, 80),
            code: String(error?.code || error?.status || "unknown").slice(0, 80),
            ...(context.id ? { id: String(context.id).slice(0, 120) } : {})
        };
        if (isDevelopment) console[method](label, safe, error);
        else console[method](label, safe);
    };

    window.ClassRecordDiagnostics = Object.freeze({
        warn: (label, error, context) => report("warn", label, error, context),
        error: (label, error, context) => report("error", label, error, context)
    });

    const settle = (promise, label) => Promise.resolve(promise).catch((error) => {
        window.ClassRecordDiagnostics.warn(`${label} cleanup failed`, error);
        return false;
    });

    const clearStorage = (storage, label) => {
        try {
            storage.clear();
        } catch (error) {
            window.ClassRecordDiagnostics.warn(`${label} cleanup failed`, error);
        }
    };

    const clearIndexedDb = async () => {
        if (!("indexedDB" in window)) return;
        if (typeof indexedDB.databases !== "function") return;
        const databases = await indexedDB.databases();
        await Promise.all((databases || []).map(({ name }) => {
            if (!name) return Promise.resolve();
            return new Promise((resolve) => {
                const request = indexedDB.deleteDatabase(name);
                request.onsuccess = request.onerror = request.onblocked = () => resolve();
            });
        }));
    };

    const clearCacheStorage = async () => {
        if (!("caches" in window)) return;
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
    };

    const unregisterServiceWorkers = async () => {
        if (!("serviceWorker" in navigator)) return;
        const registrations = await navigator.serviceWorker.getRegistrations();
        const currentOrigin = window.location.origin;
        await Promise.all(registrations
            .filter((registration) => {
                const scriptUrl = registration.active?.scriptURL
                    || registration.waiting?.scriptURL
                    || registration.installing?.scriptURL;
                return !scriptUrl || new URL(scriptUrl, window.location.href).origin === currentOrigin;
            })
            .map((registration) => registration.unregister()));
    };

    window.clearAllSiteCache = ({ preserveRedirectTarget = false } = {}) => {
        if (clearingPromise) return clearingPromise;
        clearingPromise = (async () => {
            const redirectTarget = preserveRedirectTarget
                ? sessionStorage.getItem("classRecordRedirectTarget")
                : null;

            window.dispatchEvent(new Event("classrecordcacheclearing"));
            clearStorage(localStorage, "localStorage");
            clearStorage(sessionStorage, "sessionStorage");
            if (redirectTarget) sessionStorage.setItem("classRecordRedirectTarget", redirectTarget);

            await Promise.all([
                settle(clearIndexedDb(), "IndexedDB"),
                settle(clearCacheStorage(), "Cache Storage"),
                settle(unregisterServiceWorkers(), "Service Worker")
            ]);

            window.ClassRecordHiddenModeActive = false;
            document.documentElement.removeAttribute("data-background-id");
            document.documentElement.removeAttribute("data-background-theme-ready");
            window.dispatchEvent(new Event("classrecordcachecleared"));
        })().finally(() => {
            clearingPromise = null;
        });
        return clearingPromise;
    };
})();

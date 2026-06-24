(() => {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    window.addEventListener("load", () => {
        navigator.serviceWorker.getRegistrations()
            .then((registrations) => Promise.all(
                registrations
                    .filter((registration) => registration.active?.scriptURL?.includes("service-worker.js"))
                    .map((registration) => registration.unregister())
            ))
            .catch(() => {});
    }, { once: true });
})();

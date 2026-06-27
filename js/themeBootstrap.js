(() => {
    const root = document.documentElement;
    const backgroundKey = "classRecordBackgroundId";
    const snapshotKey = "classRecordActiveTheme.v1";
    const backgroundImages = {
        "your-name": "images/backgrounds/your-name.png",
        "weathering-with-you": "images/backgrounds/weathering-with-you.png",
        "blue-sky-mountain": "images/backgrounds/blue-sky-mountain.jpg",
        "red-sun": "images/backgrounds/red-sun.png",
        "green-forest": "images/backgrounds/green-forest.png",
        "dark-blue-sky": "images/backgrounds/dark-blue-sky.jpg",
        "dark-red-ship": "images/backgrounds/dark-red-ship.png",
        "pink-orange": "images/backgrounds/pink-orange.jpg"
    };

    try {
        const backgroundId = localStorage.getItem(backgroundKey) || "default";
        const image = backgroundImages[backgroundId] || "";
        const snapshot = JSON.parse(localStorage.getItem(snapshotKey) || "null");
        root.dataset.backgroundId = backgroundId;
        root.dataset.backgroundThemeReady = "false";
        root.style.setProperty("--page-bg-image", image ? `url("${image}")` : "none");
        if (snapshot?.backgroundId === backgroundId && snapshot.palette && typeof snapshot.palette === "object") {
            Object.entries(snapshot.palette).forEach(([name, value]) => {
                if (name.startsWith("--") && typeof value === "string") root.style.setProperty(name, value);
            });
            root.dataset.backgroundThemeReady = "true";
        }
        root.dataset.themeBootstrapped = "true";
    } catch (error) {
        root.dataset.backgroundId = "default";
        root.dataset.backgroundThemeReady = "true";
        root.dataset.themeBootstrapped = "true";
    }
})();

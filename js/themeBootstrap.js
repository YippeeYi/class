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
    const dominantColors = {
        "your-name": [68, 113, 157],
        "weathering-with-you": [72, 132, 170],
        "blue-sky-mountain": [76, 117, 145],
        "red-sun": [176, 91, 61],
        "green-forest": [61, 108, 75],
        "dark-blue-sky": [48, 66, 105],
        "dark-red-ship": [111, 52, 49],
        "pink-orange": [169, 91, 116]
    };
    const mix = (rgb, target, amount) => rgb.map((value, index) => Math.round(value * (1 - amount) + target[index] * amount));
    const hex = (rgb) => `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
    const rgbText = (rgb) => rgb.join(", ");
    const buildPreset = (rgb) => {
        const accent = mix(rgb, [255, 255, 255], 0.08);
        const strong = mix(rgb, [0, 0, 0], 0.46);
        const surface = mix(rgb, [255, 255, 255], 0.9);
        const surfaceStrong = mix(rgb, [255, 255, 255], 0.8);
        return {
            "--theme-accent": hex(accent),
            "--theme-accent-strong": hex(strong),
            "--theme-surface": hex(surface),
            "--theme-surface-strong": hex(surfaceStrong),
            "--theme-rgb": rgbText(accent),
            "--accent-dark": hex(strong),
            "--page-bg-base": `radial-gradient(circle at 20% -10%, rgba(${rgbText(surface)}, .98), rgba(${rgbText(surfaceStrong)}, .95))`,
            "--control-bg": `rgba(${rgbText(surface)}, .52)`,
            "--control-hover-bg": `rgba(${rgbText(surfaceStrong)}, .68)`,
            "--control-border": `rgba(${rgbText(strong)}, .22)`,
            "--control-gradient": `linear-gradient(145deg, rgba(${rgbText(surface)}, .98), rgba(${rgbText(surfaceStrong)}, .96))`,
            "--control-gradient-hover": `linear-gradient(145deg, #fff, rgba(${rgbText(surfaceStrong)}, .98))`,
            "--control-active-gradient": `linear-gradient(135deg, ${hex(strong)}, ${hex(accent)})`,
            "--control-shadow": `0 8px 18px rgba(${rgbText(strong)}, .14)`,
            "--control-shadow-hover": `0 12px 24px rgba(${rgbText(strong)}, .2)`,
            "--control-shadow-pressed": `0 4px 10px rgba(${rgbText(strong)}, .18)`,
            "--control-active-glow": `0 0 0 1px rgba(${rgbText(strong)}, .2), 0 12px 26px rgba(${rgbText(strong)}, .24)`,
            "--shadow-soft": `0 14px 34px rgba(${rgbText(strong)}, .14)`,
            "--focus-ring": `0 0 0 2px ${hex(surface)}, 0 0 0 4px rgba(${rgbText(accent)}, .4)`,
            "--field-border": `2px solid rgba(${rgbText(strong)}, .18)`,
            "--overlay-backdrop": `rgba(${rgbText(strong)}, .26)`,
            "--overlay-card-bg": `rgba(${rgbText(surface)}, .96)`,
            "--overlay-card-shadow": `0 20px 40px rgba(${rgbText(strong)}, .22)`,
            "--panel-border": `2px solid rgba(${rgbText(strong)}, .16)`,
            "--panel-bg": `rgba(${rgbText(surface)}, .5)`,
            "--nav-bg": `rgba(${rgbText(surface)}, .68)`,
            "--nav-border": `rgba(${rgbText(strong)}, .14)`,
            "--bg-card": `rgba(${rgbText(surface)}, .58)`,
            "--guide-panel-bg": `rgba(${rgbText(surface)}, .86)`,
            "--guide-card-bg": `linear-gradient(160deg, rgba(${rgbText(surface)}, .98), rgba(${rgbText(surfaceStrong)}, .96))`,
            "--progress-track-bg": `rgba(${rgbText(surfaceStrong)}, .66)`,
            "--table-header-bg": `linear-gradient(135deg, rgba(${rgbText(surface)}, .94), rgba(${rgbText(surfaceStrong)}, .94))`,
            "--table-row-hover-bg": `linear-gradient(90deg, rgba(${rgbText(surfaceStrong)}, .7), rgba(${rgbText(surface)}, .78))`,
            "--important-border": `rgba(${rgbText(accent)}, .72)`,
            "--important-bg": `linear-gradient(90deg, rgba(${rgbText(surface)}, .58), rgba(${rgbText(surfaceStrong)}, .42))`,
            "--attachment-bg": `rgba(${rgbText(surface)}, .86)`,
            "--attachment-border": `rgba(${rgbText(strong)}, .34)`,
            "--tooltip-bg": `rgba(${rgbText(surface)}, .96)`,
            "--link-soft-bg": `rgba(${rgbText(surfaceStrong)}, .72)`,
            "--saying-soft-bg": `rgba(${rgbText(surface)}, .74)`
        };
    };
    window.ClassRecordThemePresets = Object.fromEntries(
        Object.entries(dominantColors).map(([id, rgb]) => [id, buildPreset(rgb)])
    );

    try {
        const backgroundId = localStorage.getItem(backgroundKey) || "default";
        const image = backgroundImages[backgroundId] || "";
        const snapshot = JSON.parse(localStorage.getItem(snapshotKey) || "null");
        root.dataset.backgroundId = backgroundId;
        root.dataset.backgroundThemeReady = image ? "false" : "true";
        root.style.setProperty("--page-bg-image", image ? `url("${image}")` : "none");
        if (image && ![...document.querySelectorAll('link[rel="preload"][as="image"]')]
            .some((link) => link.href === new URL(image, window.location.href).href)) {
            const preload = document.createElement("link");
            preload.rel = "preload";
            preload.as = "image";
            preload.href = image;
            preload.fetchPriority = "high";
            document.head.appendChild(preload);
        }
        const palette = snapshot?.backgroundId === backgroundId && snapshot.palette && Object.keys(snapshot.palette).length
            ? snapshot.palette
            : window.ClassRecordThemePresets[backgroundId];
        if (palette && typeof palette === "object") {
            Object.entries(palette).forEach(([name, value]) => {
                if (name.startsWith("--") && typeof value === "string") root.style.setProperty(name, value);
            });
            root.dataset.backgroundThemeReady = "true";
        }
        root.dataset.themeBootstrapped = "true";
        root.classList.add("theme-initialized");
    } catch (error) {
        root.dataset.backgroundId = "default";
        root.dataset.backgroundThemeReady = "true";
        root.dataset.themeBootstrapped = "true";
        root.classList.add("theme-initialized");
    }
})();

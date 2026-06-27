(function () {
    const storageKey = "classRecordBackgroundId";
    const options = Array.isArray(window.BACKGROUND_OPTIONS) ? window.BACKGROUND_OPTIONS : [];

    if (!options.length || !document.body) {
        return;
    }

    const root = document.documentElement;
    const fallbackId = options[0].id;
    const preloadLinkCache = new Set();
    const imageWarmCache = new Map();
    const paletteMemoryCache = new Map();
    const paletteStorageKey = "classRecordBackgroundPalette.v2";
    const paletteSessionKey = "classRecordBackgroundPaletteSession.v1";
    const activeThemeSnapshotKey = "classRecordActiveTheme.v1";
    const categoryOrder = ["基础", "影像", "风景", "其他"];

    const storage = {
        get() {
            try {
                return window.localStorage.getItem(storageKey);
            } catch (error) {
                return null;
            }
        },
        set(value) {
            try {
                window.localStorage.setItem(storageKey, value);
            } catch (error) {
                // Ignore storage failures and keep the selected background for this session.
            }
        }
    };

    const normalizeOption = (option) => {
        const secureImage = Boolean(window.ClassRecordData?.isEnabled?.() && option.image);
        return {
            id: String(option.id || ""),
            category: option.category || "其他",
            label: option.label || option.id,
            meta: option.meta || "Custom background",
            image: option.image || "",
            fit: option.fit || "cover",
            position: option.position || "center center",
            preview: secureImage ? "linear-gradient(145deg, var(--theme-surface), var(--theme-surface-strong))" : (option.preview || (option.image ? `url("${option.image}")` : "linear-gradient(145deg, #fffdf8, #f3ece1 56%, #ece5d9)"))
        };
    };

    const normalizedOptions = options.map(normalizeOption).filter((option) => option.id);
    const normalizedById = new Map(normalizedOptions.map((option) => [option.id, option]));
    let currentId = storage.get();
    let activeThemeToken = 0;

    if (!normalizedById.has(currentId)) {
        currentId = fallbackId;
        storage.set(currentId);
    }

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const toRgbString = (rgb) => `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    const toHex = (rgb) => `#${[rgb.r, rgb.g, rgb.b]
        .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
        .join("")}`;

    const rgbToHsl = ({ r, g, b }) => {
        const red = r / 255;
        const green = g / 255;
        const blue = b / 255;
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const lightness = (max + min) / 2;

        if (max === min) {
            return { h: 0, s: 0, l: lightness };
        }

        const delta = max - min;
        const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
        let hue = 0;
        if (max === red) {
            hue = (green - blue) / delta + (green < blue ? 6 : 0);
        } else if (max === green) {
            hue = (blue - red) / delta + 2;
        } else {
            hue = (red - green) / delta + 4;
        }

        return { h: hue / 6, s: saturation, l: lightness };
    };

    const hueToRgb = (p, q, t) => {
        let next = t;
        if (next < 0) next += 1;
        if (next > 1) next -= 1;
        if (next < 1 / 6) return p + (q - p) * 6 * next;
        if (next < 1 / 2) return q;
        if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
        return p;
    };

    const hslToRgb = ({ h, s, l }) => {
        if (s === 0) {
            const gray = Math.round(l * 255);
            return { r: gray, g: gray, b: gray };
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        return {
            r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
            g: Math.round(hueToRgb(p, q, h) * 255),
            b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255)
        };
    };

    const luminance = ({ r, g, b }) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    const applyDefaultTheme = () => {
        [
            "--theme-accent", "--theme-accent-strong", "--theme-surface", "--theme-surface-strong", "--theme-rgb",
            "--page-bg-base", "--page-bg-overlay", "--control-bg", "--control-hover-bg", "--control-border",
            "--panel-border", "--panel-bg", "--nav-bg", "--nav-border", "--control-gradient", "--control-gradient-hover",
            "--control-active-gradient", "--control-active-glow", "--control-shadow", "--control-shadow-hover",
            "--control-shadow-pressed", "--focus-ring", "--control-text", "--control-active-text", "--accent-dark",
            "--bg-card", "--guide-panel-bg", "--guide-card-bg", "--progress-track-bg", "--table-header-bg",
            "--table-row-hover-bg", "--table-row-hover-edge", "--table-row-hover-border", "--important-border", "--important-bg",
            "--attachment-bg", "--attachment-border", "--tooltip-bg", "--link-soft-bg", "--term-soft-bg"
        ].forEach((name) => root.style.removeProperty(name));
    };

    const commitThemeChange = () => {
        const revision = (Number(root.dataset.backgroundThemeRevision) || 0) + 1;
        root.dataset.backgroundThemeRevision = String(revision);
        document.body?.classList.toggle("is-theme-repaint-alt", revision % 2 === 1);
        document.body?.offsetHeight;
    };

    const applyPaletteTheme = (palette) => {
        if (!palette) {
            applyDefaultTheme();
            commitThemeChange();
            return;
        }

        Object.entries(palette).forEach(([name, value]) => root.style.setProperty(name, value));
        commitThemeChange();
    };

    const readPaletteCache = (storageKey, storageArea) => {
        try {
            const raw = storageArea.getItem(storageKey);
            const cache = raw ? JSON.parse(raw) : {};
            return cache && typeof cache === "object" ? cache : {};
        } catch (error) {
            return {};
        }
    };

    const readPaletteSessionCache = () => readPaletteCache(paletteSessionKey, window.sessionStorage);
    const readPaletteStorageCache = () => readPaletteCache(paletteStorageKey, window.localStorage);

    const writePaletteCache = (storageKey, storageArea, imageSrc, palette) => {
        if (!imageSrc || !palette) {
            return;
        }
        try {
            const cache = readPaletteCache(storageKey, storageArea);
            cache[imageSrc] = palette;
            storageArea.setItem(storageKey, JSON.stringify(cache));
        } catch (error) {
            // Ignore storage limits; the in-memory palette cache still covers this page.
        }
    };

    const writePaletteCaches = (imageSrc, palette) => {
        writePaletteCache(paletteSessionKey, window.sessionStorage, imageSrc, palette);
        writePaletteCache(paletteStorageKey, window.localStorage, imageSrc, palette);
    };

    const buildPalette = (dominantRgb) => {
        const dominant = rgbToHsl(dominantRgb);
        const hue = dominant.h;
        const saturation = clamp(dominant.s, 0.24, 0.72);
        const accentStrong = hslToRgb({ h: hue, s: clamp(saturation * 1.05, 0.28, 0.78), l: clamp(dominant.l * 0.58, 0.22, 0.36) });
        const accent = hslToRgb({ h: hue, s: clamp(saturation * 0.96, 0.24, 0.68), l: clamp(dominant.l * 0.82, 0.34, 0.5) });
        const surface = hslToRgb({ h: hue, s: clamp(saturation * 0.3, 0.08, 0.26), l: 0.96 });
        const surfaceStrong = hslToRgb({ h: hue, s: clamp(saturation * 0.38, 0.1, 0.32), l: 0.91 });
        const overlayTop = hslToRgb({ h: hue, s: clamp(saturation * 0.32, 0.1, 0.22), l: 0.985 });
        const overlayBottom = hslToRgb({ h: hue, s: clamp(saturation * 0.28, 0.08, 0.2), l: 0.94 });
        const controlText = luminance(surfaceStrong) > 0.72 ? "#1a1a1c" : "#f8f7f4";
        const controlActiveText = luminance(accentStrong) > 0.56 ? "#1a1a1c" : "#f8f7f4";

        return {
            "--theme-accent": toHex(accent),
            "--theme-accent-strong": toHex(accentStrong),
            "--theme-surface": toHex(surface),
            "--theme-surface-strong": toHex(surfaceStrong),
            "--theme-rgb": toRgbString(accent),
            "--page-bg-base": `radial-gradient(circle at 20% -10%, rgba(${toRgbString(overlayTop)}, 0.98) 0%, rgba(${toRgbString(surface)}, 0.94) 42%, rgba(${toRgbString(overlayBottom)}, 0.96) 100%)`,
            "--page-bg-overlay": "none",
            "--control-bg": `rgba(${toRgbString(surface)}, 0.42)`,
            "--control-hover-bg": `rgba(${toRgbString(surfaceStrong)}, 0.56)`,
            "--control-border": `rgba(${toRgbString(accentStrong)}, 0.2)`,
            "--panel-border": `2px solid rgba(${toRgbString(accentStrong)}, 0.16)`,
            "--panel-bg": `rgba(${toRgbString(surface)}, 0.4)`,
            "--nav-bg": `rgba(${toRgbString(surface)}, 0.4)`,
            "--nav-border": `rgba(${toRgbString(accentStrong)}, 0.1)`,
            "--control-gradient": `linear-gradient(130deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0) 35%), linear-gradient(145deg, rgba(${toRgbString(surface)}, 0.96), rgba(${toRgbString(surfaceStrong)}, 0.94) 56%, rgba(${toRgbString(overlayBottom)}, 0.92))`,
            "--control-gradient-hover": `linear-gradient(130deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0) 38%), linear-gradient(145deg, rgba(${toRgbString(surface)}, 0.98), rgba(${toRgbString(surfaceStrong)}, 0.98) 48%, rgba(${toRgbString(overlayBottom)}, 0.94))`,
            "--control-active-gradient": `linear-gradient(125deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0) 42%), linear-gradient(135deg, rgba(${toRgbString(accentStrong)}, 1), rgba(${toRgbString(accent)}, 1) 58%, rgba(${toRgbString(accent)}, 0.88))`,
            "--control-active-glow": `0 0 0 1px rgba(${toRgbString(accentStrong)}, 0.2), 0 12px 26px rgba(${toRgbString(accentStrong)}, 0.26)`,
            "--control-shadow": `0 8px 18px rgba(${toRgbString(accentStrong)}, 0.12)`,
            "--control-shadow-hover": `0 12px 24px rgba(${toRgbString(accentStrong)}, 0.18)`,
            "--control-shadow-pressed": `0 4px 10px rgba(${toRgbString(accentStrong)}, 0.16)`,
            "--focus-ring": `0 0 0 2px rgba(${toRgbString(surface)}, 0.95), 0 0 0 4px rgba(${toRgbString(accent)}, 0.38), 0 12px 24px rgba(${toRgbString(accentStrong)}, 0.18)`,
            "--control-text": controlText,
            "--control-active-text": controlActiveText,
            "--accent-dark": toHex(accentStrong),
            "--bg-card": `rgba(${toRgbString(surface)}, 0.48)`,
            "--guide-panel-bg": `rgba(${toRgbString(surface)}, 0.82)`,
            "--guide-card-bg": `linear-gradient(160deg, rgba(${toRgbString(surface)}, 0.96), rgba(${toRgbString(surfaceStrong)}, 0.94))`,
            "--progress-track-bg": `rgba(${toRgbString(surfaceStrong)}, 0.62)`,
            "--table-header-bg": `linear-gradient(135deg, rgba(${toRgbString(surface)}, 0.88), rgba(${toRgbString(surfaceStrong)}, 0.9))`,
            "--table-row-hover-bg": `linear-gradient(90deg, rgba(${toRgbString(surfaceStrong)}, 0.62) 0%, rgba(${toRgbString(surface)}, 0.72) 100%)`,
            "--table-row-hover-edge": `rgba(${toRgbString(accentStrong)}, 0.28)`,
            "--table-row-hover-border": `rgba(${toRgbString(accentStrong)}, 0.34)`,
            "--important-border": `rgba(${toRgbString(accent)}, 0.68)`,
            "--important-bg": `linear-gradient(90deg, rgba(${toRgbString(surface)}, 0.5), rgba(${toRgbString(surfaceStrong)}, 0.36))`,
            "--attachment-bg": `rgba(${toRgbString(surface)}, 0.82)`,
            "--attachment-border": `rgba(${toRgbString(accentStrong)}, 0.36)`,
            "--tooltip-bg": `rgba(${toRgbString(surface)}, 0.94)`,
            "--link-soft-bg": `rgba(${toRgbString(surfaceStrong)}, 0.68)`,
            "--term-soft-bg": `rgba(${toRgbString(surface)}, 0.7)`
        };
    };

    const ensureResourceHint = (imageSrc) => {
        if (!imageSrc || preloadLinkCache.has(imageSrc)) {
            return;
        }
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = imageSrc;
        document.head.appendChild(link);
        preloadLinkCache.add(imageSrc);
    };

    const resolveImageSrc = async (imageSrc) => {
        if (!imageSrc || !window.ClassRecordData?.isEnabled?.()) {
            return imageSrc;
        }
        return window.ClassRecordData.signAssetUrl(imageSrc).catch(() => "");
    };

    const warmImage = async (imageSrc, priority = "low") => {
        imageSrc = await resolveImageSrc(imageSrc);
        if (!imageSrc) {
            return Promise.resolve(null);
        }
        ensureResourceHint(imageSrc);
        if (imageWarmCache.has(imageSrc)) {
            return imageWarmCache.get(imageSrc);
        }

        const image = new Image();
        image.decoding = "async";
        image.loading = priority === "high" ? "eager" : "lazy";
        image.fetchPriority = priority;
        const promise = new Promise((resolve, reject) => {
            image.onload = () => resolve(image);
            image.onerror = reject;
        }).catch(() => null);
        image.src = imageSrc;
        imageWarmCache.set(imageSrc, promise);
        return promise;
    };

    const extractPaletteFromImage = async (imageSrc, cacheKey = imageSrc) => {
        if (!imageSrc) {
            return null;
        }
        if (paletteMemoryCache.has(cacheKey)) {
            return paletteMemoryCache.get(cacheKey);
        }

        const sessionPalette = readPaletteSessionCache()[cacheKey];
        const storedPalette = sessionPalette || readPaletteStorageCache()[cacheKey];
        if (storedPalette) {
            paletteMemoryCache.set(cacheKey, storedPalette);
            if (!sessionPalette) {
                writePaletteCache(paletteSessionKey, window.sessionStorage, cacheKey, storedPalette);
            }
            return storedPalette;
        }

        const image = await warmImage(imageSrc, "high");
        if (!image || !image.naturalWidth) {
            return null;
        }

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
            return null;
        }

        const sampleWidth = 48;
        const sampleHeight = Math.max(1, Math.round(sampleWidth * (image.naturalHeight / image.naturalWidth || 1)));
        canvas.width = sampleWidth;
        canvas.height = sampleHeight;
        context.drawImage(image, 0, 0, sampleWidth, sampleHeight);

        const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);
        const bins = new Map();
        let fallback = null;
        let fallbackWeight = -1;

        for (let y = 0; y < sampleHeight; y += 1) {
            for (let x = 0; x < sampleWidth; x += 1) {
                const offset = (y * sampleWidth + x) * 4;
                if (data[offset + 3] < 160) continue;
                const rgb = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
                const hsl = rgbToHsl(rgb);
                if ((hsl.l > 0.96 && hsl.s < 0.08) || (hsl.l < 0.08 && hsl.s < 0.16)) continue;

                const centerX = (x + 0.5) / sampleWidth - 0.5;
                const centerY = (y + 0.5) / sampleHeight - 0.5;
                const distance = Math.sqrt(centerX * centerX + centerY * centerY);
                const weight = clamp(1.35 - distance * 1.8, 0.55, 1.35) * (0.8 + hsl.s * 1.8) * (hsl.l > 0.18 && hsl.l < 0.78 ? 1.15 : 0.86);
                const key = [Math.round(rgb.r / 24), Math.round(rgb.g / 24), Math.round(rgb.b / 24)].join("-");
                const bucket = bins.get(key) || { weight: 0, r: 0, g: 0, b: 0 };
                bucket.weight += weight;
                bucket.r += rgb.r * weight;
                bucket.g += rgb.g * weight;
                bucket.b += rgb.b * weight;
                bins.set(key, bucket);

                const fallbackScore = weight * (0.9 + hsl.s) * (hsl.l > 0.16 && hsl.l < 0.74 ? 1.15 : 1);
                if (fallbackScore > fallbackWeight) {
                    fallbackWeight = fallbackScore;
                    fallback = rgb;
                }
            }
        }

        let best = null;
        bins.forEach((bucket) => {
            if (!best || bucket.weight > best.weight) {
                best = bucket;
            }
        });

        const dominant = best
            ? { r: Math.round(best.r / best.weight), g: Math.round(best.g / best.weight), b: Math.round(best.b / best.weight) }
            : fallback;
        const palette = dominant ? buildPalette(dominant) : null;
        paletteMemoryCache.set(cacheKey, palette);
        writePaletteCaches(cacheKey, palette);
        return palette;
    };

    const writeActiveThemeSnapshot = (option, palette) => {
        try {
            localStorage.setItem(activeThemeSnapshotKey, JSON.stringify({
                backgroundId: option.id,
                palette: palette || {}
            }));
        } catch (error) {
            // The in-memory theme remains active when storage is unavailable.
        }
    };

    const dispatchBackgroundEvent = (type, option, phase) => {
        window.dispatchEvent(new CustomEvent(type, { detail: { backgroundId: option.id, option, phase } }));
    };

    const syncThemeForOption = async (option, token) => {
        if (!option.image) {
            if (token === activeThemeToken) {
                applyDefaultTheme();
                root.dataset.backgroundThemeReady = "true";
                writeActiveThemeSnapshot(option, null);
            }
            return null;
        }
        try {
            const imageSrc = await resolveImageSrc(option.image);
            const palette = await extractPaletteFromImage(imageSrc, option.image);
            if (token === activeThemeToken) {
                applyPaletteTheme(palette);
                root.dataset.backgroundThemeReady = "true";
                writeActiveThemeSnapshot(option, palette);
            }
            return palette;
        } catch (error) {
            if (token === activeThemeToken) {
                applyDefaultTheme();
                root.dataset.backgroundThemeReady = "true";
            }
            return null;
        }
    };

    const warmVisibleBackgrounds = (activeOption) => {
        if (activeOption.image) warmImage(activeOption.image, "high");
    };

    const applyBackground = (id, { persist = true, notify = true } = {}) => {
        const option = normalizedById.get(id) || normalizedOptions[0];
        if (!option.image) {
            root.style.setProperty("--page-bg-image", "none");
        } else if (currentId !== option.id || !root.style.getPropertyValue("--page-bg-image") || root.style.getPropertyValue("--page-bg-image") === "none") {
            root.style.setProperty("--page-bg-image", `url("${option.image}")`);
        }
        root.style.setProperty("--page-bg-size", option.image ? option.fit : "cover");
        root.style.setProperty("--page-bg-position", option.position || "center center");
        root.style.setProperty("--page-bg-repeat", "no-repeat");
        root.dataset.backgroundId = option.id;
        currentId = option.id;
        if (persist) {
            storage.set(option.id);
        }
        activeThemeToken += 1;
        const token = activeThemeToken;
        const cachedPalette = option.image
            ? (readPaletteSessionCache()[option.image] || readPaletteStorageCache()[option.image])
            : null;
        if (cachedPalette) applyPaletteTheme(cachedPalette);
        root.dataset.backgroundThemeReady = option.image && !cachedPalette ? "false" : "true";
        if (option.image) {
            resolveImageSrc(option.image).then((signedSrc) => {
                if (token === activeThemeToken && signedSrc) {
                    root.style.setProperty("--page-bg-image", `url("${signedSrc}")`);
                }
            });
        }
        warmVisibleBackgrounds(option);
        if (notify) {
            dispatchBackgroundEvent("backgroundchanging", option, "start");
        }
        const themeReady = syncThemeForOption(option, token).then(() => {
            if (token !== activeThemeToken) {
                return option;
            }
            dispatchBackgroundEvent("backgroundthemechange", option, "theme-ready");
            if (notify) {
                dispatchBackgroundEvent("backgroundchange", option, "complete");
            }
            return option;
        });
        option.themeReady = themeReady;
        return option;
    };

    const getSortedOptions = () => {
        const categoryMap = normalizedOptions.reduce((groups, option) => {
            const bucket = groups.get(option.category) || [];
            bucket.push(option);
            groups.set(option.category, bucket);
            return groups;
        }, new Map());
        return categoryOrder
            .filter((category) => categoryMap.has(category))
            .concat([...categoryMap.keys()].filter((category) => !categoryOrder.includes(category)))
            .flatMap((category) => categoryMap.get(category));
    };

    const ensureFullscreenControl = () => {
        if (!document.fullscreenEnabled || document.querySelector(".fullscreen-toggle")) {
            return;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn-action fullscreen-toggle";
        const updateLabel = () => {
            const isFullscreen = Boolean(document.fullscreenElement);
            button.textContent = isFullscreen ? "🔳" : "⛶";
            button.setAttribute("aria-label", isFullscreen ? "退出全屏" : "进入全屏");
            button.setAttribute("title", isFullscreen ? "退出全屏" : "进入全屏");
        };
        button.addEventListener("click", async () => {
            try {
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                } else {
                    await document.documentElement.requestFullscreen();
                }
            } catch (error) {
                // Ignore browser-specific fullscreen failures.
            }
        });
        document.addEventListener("fullscreenchange", updateLabel);
        updateLabel();

        const host = document.querySelector(".page-header") || document.querySelector(".top-right-actions");
        if (host) {
            host.appendChild(button);
        } else {
            const floatingHost = document.createElement("div");
            floatingHost.className = "page-header page-header--floating";
            floatingHost.appendChild(button);
            document.body.appendChild(floatingHost);
        }
    };

    window.BackgroundState = {
        get currentId() {
            return currentId;
        },
        get options() {
            return getSortedOptions().map((option) => ({
                ...option,
                active: option.id === currentId
            }));
        },
        apply(id, options) {
            return applyBackground(id, options);
        },
        warm(imageSrc, priority) {
            return warmImage(imageSrc, priority);
        },
        owns() {
            return true;
        }
    };

    ensureFullscreenControl();
    applyBackground(currentId, { persist: false, notify: false });
})();

# Background image specs

Recommended:

- Aspect ratio: `16:9`
- Minimum size: `1920 x 1080`
- Best size: `2560 x 1440`
- Format: `webp` preferred, `jpg` acceptable
- Target file size: `300 KB` to `900 KB` each

Tips:

- Keep the main subject away from the center, because cards and tables sit in the middle area.
- Use low-noise images with soft contrast so text remains readable behind translucent panels.
- Avoid photos with small text, sharp patterns, or very dark corners.

Usage:

1. Put files in `images/backgrounds/`
2. Add a 640 px-wide, quality 65–75 `*-preview.jpg` beside each original for the chooser
3. Add both the original `image` and compressed `preview` paths plus credit to `src/components/layout/background-root.tsx`
4. Keep the matching original startup filename in `public/theme-bootstrap.js` so only the already-selected background appears before React mounts

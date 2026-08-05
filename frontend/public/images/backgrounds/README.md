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
2. Add the relative path and credit to `src/components/layout/background-root.tsx`
3. Keep the matching startup filename in `public/theme-bootstrap.js` so the selected image appears before React mounts

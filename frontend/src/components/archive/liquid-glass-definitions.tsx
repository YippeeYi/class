/**
 * One document-level refraction filter for small decorative highlight layers.
 * Backdrop blur remains owned by each semantic glass group; this filter never
 * duplicates that expensive sampling pass.
 */
export function LiquidGlassDefinitions() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="app-liquid-filter-definitions"
      width="0"
      height="0"
    >
      <defs>
        <filter
          id="app-liquid-glass-refraction"
          x="-12%"
          y="-24%"
          width="124%"
          height="148%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.014 0.042"
            numOctaves="1"
            seed="13"
            result="surface"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="surface"
            scale="2.4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}

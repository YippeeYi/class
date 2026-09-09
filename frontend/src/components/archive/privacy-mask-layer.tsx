import type { PrivacyMask } from '@/types/domain'

export function PrivacyMaskLayer({ masks = [] }: { masks?: PrivacyMask[] }) {
  if (!masks.length) return null
  return (
    <div
      className="privacy-mask-layer pointer-events-none absolute inset-0 z-10"
      aria-hidden="true"
    >
      {masks.map((mask) => (
        <span
          key={`${mask.x}-${mask.y}-${mask.width}-${mask.height}`}
          className="privacy-mask absolute block"
          style={{
            left: `${mask.x}%`,
            top: `${mask.y}%`,
            width: `${mask.width}%`,
            height: `${mask.height}%`,
          }}
        />
      ))}
    </div>
  )
}

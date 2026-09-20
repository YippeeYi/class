import { cn } from '@/lib/utils'

export function ChronicleLogo({ className }: { className?: string }) {
  return (
    <div
      data-guide-logo
      role="img"
      aria-label="编日史项目标识"
      className={cn('inline-flex items-center gap-3', className)}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className="size-12 shrink-0">
        <path
          d="M10.5 13.5c8-2.6 15.2-.6 21.5 5.2 6.3-5.8 13.5-7.8 21.5-5.2v36.2c-8-2.1-15.2.1-21.5 6.3-6.3-6.2-13.5-8.4-21.5-6.3V13.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinejoin="round"
          className="text-foreground"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M32 18.7V56"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          className="text-foreground"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M20 27h8m8 8h8m-24 8h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          className="text-primary"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="32" cy="27" r="2.5" fill="currentColor" className="text-primary" />
        <circle cx="32" cy="35" r="2.5" fill="currentColor" className="text-primary" />
        <circle cx="32" cy="43" r="2.5" fill="currentColor" className="text-primary" />
      </svg>
      <span className="font-heading text-lg font-semibold tracking-[0.12em] text-foreground">
        编日史
      </span>
    </div>
  )
}

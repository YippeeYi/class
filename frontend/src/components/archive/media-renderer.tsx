import { type CSSProperties, useEffect, useRef, useState } from 'react'

import { ImageViewer } from '@/components/archive/image-viewer'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import type { MarkupNode } from '@/lib/markup'
import {
  getImageDimensions,
  preloadImageDimensions,
  preloadMediaManifest,
  rememberImageDimensions,
  useImageDimensions,
} from '@/services/image-metadata'

type MediaNode = Extract<MarkupNode, { type: 'media' }>

function MediaLoadingSpinner() {
  return (
    <span className="record-media-spinner">
      <Spinner className="size-5" aria-label="媒体加载中" />
    </span>
  )
}

function useVisible<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || visible) return
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '250px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [visible])
  return { ref, visible }
}

function ImageMediaRenderer({ src }: { src: string }) {
  const { ref, visible } = useVisible<HTMLSpanElement>()
  const dimensions = useImageDimensions(src, visible, 720)
  const asset = useSignedAsset(visible ? src : '', { variant: 'preview', width: 720 })
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [metadataFailed, setMetadataFailed] = useState(false)
  useEffect(() => {
    if (!visible || dimensions) return
    let active = true
    void (async () => {
      await preloadMediaManifest(src.startsWith('hidden/'))
      if (getImageDimensions(src)) return
      const value = await preloadImageDimensions(src, 720)
      if (active && !value) setMetadataFailed(true)
    })()
    return () => {
      active = false
    }
  }, [visible, dimensions, src])
  return (
    <span
      ref={ref}
      className={`record-media-image${dimensions ? ' record-media-image--measured' : failed || asset.error ? ' record-media-image--failed' : ' record-media-image--pending'}`}
      style={
        dimensions
          ? ({ '--record-media-ratio': dimensions.width / dimensions.height } as CSSProperties)
          : undefined
      }
    >
      {failed || asset.error ? (
        <span className="record-media-failure" role="status">
          图片加载失败
        </span>
      ) : (
        <>
          {(dimensions || metadataFailed) && asset.src && (
            <ImageViewer
              path={src}
              alt="记录插图"
              initialUrl={asset.src}
              initialDimensions={dimensions}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  className="record-media-image-trigger rounded-none border-0 focus-visible:border-0"
                  style={{ width: '100%', height: '100%', padding: 0 }}
                  aria-label="查看大图"
                >
                  <img
                    src={asset.src}
                    alt="记录插图"
                    width={dimensions?.width}
                    height={dimensions?.height}
                    loading="lazy"
                    decoding="async"
                    className={`record-media-image-content${loaded ? ' is-loaded' : ''}`}
                    onLoad={(event) => {
                      rememberImageDimensions(src, {
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      })
                      setLoaded(true)
                    }}
                    onError={() => setFailed(true)}
                  />
                </Button>
              }
            />
          )}
          {!loaded && dimensions && <MediaLoadingSpinner />}
        </>
      )}
    </span>
  )
}

function VideoMediaRenderer({ src }: { src: string }) {
  const { ref, visible } = useVisible<HTMLDivElement>()
  const dimensions = useImageDimensions(src, visible)
  const asset = useSignedAsset(visible ? src : '')
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [fallbackRatio, setFallbackRatio] = useState(false)
  useEffect(() => {
    if (!visible || dimensions) return
    let active = true
    void (async () => {
      await preloadMediaManifest(src.startsWith('hidden/'))
      if (getImageDimensions(src)) return
      const value = await preloadImageDimensions(src)
      if (active && !value) setFallbackRatio(true)
    })()
    return () => {
      active = false
    }
  }, [visible, dimensions, src])
  const frameDimensions = fallbackRatio ? null : dimensions
  const hasFrame = Boolean(frameDimensions || fallbackRatio)
  return (
    <div
      ref={ref}
      className={`record-media-video${hasFrame ? '' : failed || asset.error ? ' record-media-video--failed' : ' record-media-video--pending'}`}
      style={{
        aspectRatio: frameDimensions
          ? `${frameDimensions.width} / ${frameDimensions.height}`
          : fallbackRatio
            ? '16 / 9'
            : undefined,
      }}
    >
      {failed || asset.error ? (
        <div className="record-media-failure" role="status">
          视频加载失败
        </div>
      ) : (
        <>
          <video
            src={asset.src || undefined}
            controls
            playsInline
            preload="metadata"
            onLoadedData={() => setLoaded(true)}
            onLoadedMetadata={(event) =>
              rememberImageDimensions(src, {
                width: event.currentTarget.videoWidth,
                height: event.currentTarget.videoHeight,
              })
            }
            onError={() => setFailed(true)}
            aria-label="记录视频"
          >
            <track kind="captions" />
          </video>
          {!loaded && hasFrame && <MediaLoadingSpinner />}
        </>
      )}
    </div>
  )
}

export function MediaRenderer({ node }: { node: MediaNode }) {
  return node.mediaType === 'image' ? (
    <ImageMediaRenderer src={node.src} />
  ) : (
    <VideoMediaRenderer src={node.src} />
  )
}

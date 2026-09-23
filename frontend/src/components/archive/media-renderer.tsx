import { useEffect, useRef, useState } from 'react'

import { ImageViewer } from '@/components/archive/image-viewer'
import { Button } from '@/components/ui/button'
import { useSignedAsset } from '@/hooks/use-signed-asset'
import type { MarkupNode } from '@/lib/markup'
import {
  preloadImageDimensions,
  rememberImageDimensions,
  useImageDimensions,
} from '@/services/image-metadata'

type MediaNode = Extract<MarkupNode, { type: 'media' }>

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
    void preloadImageDimensions(src, 720).then((value) => {
      if (active && !value) setMetadataFailed(true)
    })
    return () => {
      active = false
    }
  }, [visible, dimensions, src])
  const frame = dimensions
    ? {
        width: Math.round(
          dimensions.width * Math.min(1, 360 / dimensions.width, 280 / dimensions.height),
        ),
        height: Math.round(
          dimensions.height * Math.min(1, 360 / dimensions.width, 280 / dimensions.height),
        ),
      }
    : null
  return (
    <span
      ref={ref}
      className="record-media-image"
      style={
        frame ? { width: frame.width, aspectRatio: `${frame.width} / ${frame.height}` } : undefined
      }
    >
      {failed || asset.error ? (
        <span className="record-media-failure" role="status">
          图片加载失败
        </span>
      ) : (frame || metadataFailed) && asset.src ? (
        <ImageViewer
          path={src}
          alt="记录插图"
          initialUrl={asset.src}
          initialDimensions={dimensions}
          trigger={
            <Button
              type="button"
              variant="ghost"
              className="record-media-image-trigger"
              style={{ width: '100%', height: '100%', padding: 0 }}
              aria-label="查看大图"
            >
              <img
                src={asset.src}
                alt="记录插图"
                width={frame?.width}
                height={frame?.height}
                loading="lazy"
                decoding="async"
                className="record-media-image-content"
                onLoad={(event) => {
                  rememberImageDimensions(src, {
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  })
                  setLoaded(true)
                }}
                onError={() => setFailed(true)}
              />
              {!loaded && <span className="sr-only">图片加载中</span>}
            </Button>
          }
        />
      ) : (
        <span className="record-media-loading" role="status">
          图片加载中
        </span>
      )}
    </span>
  )
}

function VideoMediaRenderer({ src }: { src: string }) {
  const { ref, visible } = useVisible<HTMLDivElement>()
  const asset = useSignedAsset(visible ? src : '')
  const [failed, setFailed] = useState(false)
  return (
    <div ref={ref} className="record-media-video">
      {failed || asset.error ? (
        <div className="record-media-failure" role="status">
          视频加载失败
        </div>
      ) : (
        <video
          src={asset.src || undefined}
          controls
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          aria-label="记录视频"
        >
          <track kind="captions" />
        </video>
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

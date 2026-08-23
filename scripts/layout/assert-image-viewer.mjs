import assert from 'node:assert/strict'

export async function assertFullscreenImageViewer(page, label) {
  const trigger = page.getByRole('button', { name: '打开全视口测试图片' })
  await trigger.scrollIntoViewIfNeeded()
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  const scrollBeforeOpen = await page.evaluate(() => window.scrollY)
  await trigger.click()
  const dialog = page.locator('.image-viewer-dialog[data-slot="dialog-content"]')
  await dialog.waitFor({ state: 'visible' })
  await dialog.locator('img[alt="全视口测试图片"]').waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.querySelector('img[alt="全视口测试图片"]')?.naturalWidth > 0)
  const geometry = await page.evaluate(() => {
    const content = document.querySelector('.image-viewer-dialog[data-slot="dialog-content"]')
    const overlay = document.querySelector('[data-slot="dialog-overlay"]')
    const image = document.querySelector('img[alt="全视口测试图片"]')
    const toolbar = content?.firstElementChild?.nextElementSibling
    const contentBounds = content?.getBoundingClientRect()
    const overlayBounds = overlay?.getBoundingClientRect()
    const imageBounds = image?.getBoundingClientRect()
    const viewportWidth = window.visualViewport?.width || window.innerWidth
    const viewportHeight = window.visualViewport?.height || window.innerHeight
    return {
      viewportWidth,
      viewportHeight,
      content: contentBounds && {
        top: contentBounds.top,
        left: contentBounds.left,
        right: contentBounds.right,
        bottom: contentBounds.bottom,
        width: contentBounds.width,
        height: contentBounds.height,
      },
      overlay: overlayBounds && {
        top: overlayBounds.top,
        left: overlayBounds.left,
        right: overlayBounds.right,
        bottom: overlayBounds.bottom,
        backdrop: getComputedStyle(overlay).backdropFilter,
        background: getComputedStyle(overlay).backgroundColor,
      },
      image: imageBounds && {
        top: imageBounds.top,
        left: imageBounds.left,
        right: imageBounds.right,
        bottom: imageBounds.bottom,
      },
      position: content ? getComputedStyle(content).position : '',
      transform: content ? getComputedStyle(content).transform : '',
      translate: content ? getComputedStyle(content).translate : '',
      scale: content ? getComputedStyle(content).scale : '',
      portalParent: content?.parentElement?.getAttribute('data-slot') || '',
      containingBlockAncestors: content
        ? [...document.querySelectorAll('html, body, [data-slot="dialog-portal"]')]
            .filter((element) => element.contains(content) && element !== content)
            .map((element) => {
              const style = getComputedStyle(element)
              return {
                slot: element.getAttribute('data-slot') || element.tagName,
                transform: style.transform,
                filter: style.filter,
                perspective: style.perspective,
                contain: style.contain,
              }
            })
            .filter(
              (item) =>
                item.transform !== 'none' ||
                item.filter !== 'none' ||
                item.perspective !== 'none' ||
                /(?:layout|paint|strict|content)/u.test(item.contain),
            )
        : [],
      toolbarOverflow: toolbar
        ? toolbar.scrollWidth - toolbar.clientWidth
        : Number.POSITIVE_INFINITY,
      scrollY: window.scrollY,
    }
  })
  assert.equal(geometry.position, 'fixed', `${label} image viewer must be viewport-fixed`)
  assert.equal(geometry.transform, 'none', `${label} image viewer must not inherit centred-dialog translation`)
  assert.ok(
    geometry.translate === 'none' || geometry.translate === '0px',
    `${label} image viewer must neutralize Tailwind's individual translate property`,
  )
  assert.equal(geometry.scale, 'none', `${label} image viewer must not shrink during a centred-dialog zoom animation`)
  assert.equal(geometry.portalParent, 'dialog-portal', `${label} image viewer must be a direct child of the dialog portal`)
  assert.deepEqual(
    geometry.containingBlockAncestors,
    [],
    `${label} image viewer must not have a transformed, filtered or contained viewport ancestor`,
  )
  assert.ok(
    geometry.content &&
      Math.abs(geometry.content.top) <= 1 &&
      Math.abs(geometry.content.left) <= 1 &&
      Math.abs(geometry.content.right - geometry.viewportWidth) <= 1 &&
      Math.abs(geometry.content.bottom - geometry.viewportHeight) <= 1,
    `${label} image viewer must cover the exact viewport: ${JSON.stringify(geometry)}`,
  )
  assert.notEqual(
    geometry.overlay?.backdrop,
    'none',
    `${label} image overlay must blur the actual page that remains beneath the portal`,
  )
  assert.match(
    geometry.overlay?.background || '',
    /rgba\([^)]*,\s*0\.(?:5[0-9]|6[0-9]|7[0-9])\)/,
    `${label} image overlay must stay translucent instead of replacing the current page`,
  )
  assert.ok(
    geometry.overlay &&
      Math.abs(geometry.overlay.top) <= 1 &&
      Math.abs(geometry.overlay.left) <= 1 &&
      Math.abs(geometry.overlay.right - geometry.viewportWidth) <= 1 &&
      Math.abs(geometry.overlay.bottom - geometry.viewportHeight) <= 1,
    `${label} image overlay must cover the exact viewport: ${JSON.stringify(geometry)}`,
  )
  assert.ok(
    geometry.image &&
      geometry.image.top >= -1 &&
      geometry.image.left >= -1 &&
      geometry.image.right <= geometry.viewportWidth + 1 &&
      geometry.image.bottom <= geometry.viewportHeight + 1,
    `${label} initial image must be fully visible: ${JSON.stringify(geometry)}`,
  )
  assert.ok(geometry.toolbarOverflow <= 1, `${label} image toolbar must not overflow: ${JSON.stringify(geometry)}`)
  assert.ok(
    Math.abs(geometry.scrollY - scrollBeforeOpen) <= 1,
    `${label} opening the viewer must not move the page: ${JSON.stringify({ scrollBeforeOpen, scrollAfterOpen: geometry.scrollY })}`,
  )
  await page.getByRole('button', { name: '关闭大图' }).click()
  await dialog.waitFor({ state: 'hidden' })
  assert.ok(
    Math.abs((await page.evaluate(() => window.scrollY)) - scrollBeforeOpen) <= 1,
    `${label} closing the viewer must restore the unchanged page position`,
  )
}


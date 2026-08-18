import { useEffect, useState } from 'react'

/**
 * 把封面/海报地址（远程 http 或本地 file://）经主进程读成 data URL。
 * 远程图由主进程带正确 Referer 抓取以绕过防盗链，本地图则绕过 dev 下 file:// 跨域限制。
 */
export function useImageSource(source: string | null | undefined): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!source) {
      setDataUrl(null)
      return
    }
    let cancelled = false
    const api = window.neoavdc
    if (!api) return
    api
      .readImage(source)
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [source])

  return dataUrl
}

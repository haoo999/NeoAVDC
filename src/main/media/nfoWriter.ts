import type { ScrapedMetadata } from '../../shared/types'

export interface NfoOptions {
  includeLocalActorThumbs?: boolean
  posterFile?: string
  fanartFile?: string
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function element(tag: string, value: string | undefined): string {
  if (!value) return ''
  return `  <${tag}>${escapeXml(value)}</${tag}>\n`
}

function repeatElement(tag: string, values: readonly string[]): string {
  return values.map((v) => `  <${tag}>${escapeXml(v)}</${tag}>\n`).join('')
}

function yearOf(releaseDate?: string): string {
  if (!releaseDate) return ''
  const m = /(\d{4})/.exec(releaseDate)
  return m ? m[1] : ''
}

function actorThumbUrl(name: string, includeLocal: boolean, remoteUrl?: string): string {
  if (includeLocal) return `.actors/${encodeActorFile(name)}.jpg`
  return remoteUrl ?? ''
}

function encodeActorFile(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'actor'
}

function renderActors(data: ScrapedMetadata, includeLocal: boolean): string {
  return data.actors
    .map((a) => {
      const thumb = actorThumbUrl(a.name, includeLocal, a.avatarUrl)
      const thumbLine = thumb ? `\n    <thumb>${escapeXml(thumb)}</thumb>` : ''
      return `  <actor>\n    <name>${escapeXml(a.name)}</name>${thumbLine}\n    <type>Actor</type>\n  </actor>\n`
    })
    .join('')
}

export function buildNfoXml(data: ScrapedMetadata, options: NfoOptions = {}): string {
  const includeLocal = options.includeLocalActorThumbs ?? false
  const year = yearOf(data.releaseDate)
  const mpaa = data.isUncensored ? 'R18+' : 'NC-17'
  const title = data.title || data.number
  const posterRef = options.posterFile ?? data.coverUrl
  const fanartRef = options.fanartFile ?? data.coverUrl

  const parts: string[] = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n', '<movie>\n']
  parts.push(element('title', title))
  parts.push(element('originaltitle', title))
  parts.push(element('sorttitle', `${data.number} ${title}`))
  parts.push(element('customnumber', data.number))
  if (year) parts.push(element('year', year))
  if (data.releaseDate) parts.push(element('premiered', data.releaseDate))
  if (data.releaseDate) parts.push(element('releasedate', data.releaseDate))
  parts.push(element('mpaa', mpaa))
  parts.push(element('studio', data.maker))
  parts.push(element('publisher', data.publisher))
  parts.push(element('director', data.director))
  if (data.runtimeMin && data.runtimeMin > 0) {
    parts.push(element('runtime', String(Math.round(data.runtimeMin))))
  }
  if (data.series) {
    parts.push(`  <set>\n    <name>${escapeXml(data.series)}</name>\n  </set>\n`)
  }
  parts.push(repeatElement('genre', data.genres))
  parts.push(repeatElement('tag', data.genres))
  if (data.series) parts.push(element('tag', data.series))
  parts.push(element('tag', data.isUncensored ? '无码' : '有码'))
  if (posterRef || fanartRef) {
    const artLines: string[] = ['  <art>\n']
    if (posterRef) artLines.push(`    <poster>${escapeXml(posterRef)}</poster>\n`)
    if (fanartRef) artLines.push(`    <fanart>${escapeXml(fanartRef)}</fanart>\n`)
    artLines.push('  </art>\n')
    parts.push(artLines.join(''))
  }
  if (posterRef) parts.push(`  <cover>${escapeXml(posterRef)}</cover>\n`)
  parts.push(renderActors(data, includeLocal))
  parts.push(element('website', data.sourceUrl))
  parts.push('</movie>\n')
  return parts.join('')
}

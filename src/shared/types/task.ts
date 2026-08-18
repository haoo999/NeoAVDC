export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'scraping'
  | 'downloading'
  | 'success'
  | 'failed'
  | 'skipped'

export interface TaskMetadata {
  title: string
  actors: string[]
  releaseDate: string
  runtimeMin: number
  publisher: string
  series: string
  tags: string[]
  /**
   * 海报不裁切：Heyzo/FC2/欧美片的 fanart 本身就是成品封面，
   * 详情预览与落盘都跳过 2:3 裁切。
   */
  posterNoCrop?: boolean
}

export interface Task {
  id: string
  filePath: string
  fileName: string
  sizeMB: number
  status: TaskStatus
  number: string | null
  numberFromManual?: boolean
  title: string | null
  website: string | null
  error: string | null
  outputDir: string | null
  metadata: TaskMetadata | null
  coverUrl: string | null
  posterUrl: string | null
  addedAt: number
}

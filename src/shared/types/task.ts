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
}

export interface Task {
  id: string
  filePath: string
  fileName: string
  sizeMB: number
  status: TaskStatus
  number: string | null
  title: string | null
  website: string | null
  error: string | null
  outputDir: string | null
  metadata: TaskMetadata | null
  coverUrl: string | null
  posterUrl: string | null
  addedAt: number
}

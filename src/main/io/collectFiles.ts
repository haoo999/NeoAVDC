import fs from 'node:fs'
import path from 'node:path'

export interface CollectedFile {
  fullPath: string
  relativePath: string
  sizeMB: number
}

export function collectFiles(rootDir: string, exts: readonly string[]): CollectedFile[] {
  const out: CollectedFile[] = []
  const allowed = new Set(exts.map((e) => e.toLowerCase()))

  function walk(dir: string, rel: string[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        walk(full, [...rel, ent.name])
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase()
        if (allowed.has(ext)) {
          try {
            const stat = fs.statSync(full)
            out.push({
              fullPath: full,
              relativePath: path.join(...rel, ent.name),
              sizeMB: Math.round((stat.size / 1024 / 1024) * 10) / 10
            })
          } catch {
            // 无权限或文件已被删除时跳过
          }
        }
      }
    }
  }

  walk(rootDir, [])
  return out
}

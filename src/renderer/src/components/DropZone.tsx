interface DropZoneProps {
  onPickFiles: () => void
  onPickFolder: () => void
  dragOver?: boolean
}

export default function DropZone({ onPickFiles, onPickFolder }: DropZoneProps) {
  return (
    <div className="dropzone">
      <div className="dz-inner">
        <div className="dz-eyebrow">NEO · AVDC</div>
        <svg className="dz-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <h2>把视频文件或文件夹拖到这里</h2>
        <p>自动递归扫描目录、识别番号、原地整理成带海报的资料夹。你也可以手动选择。</p>
        <div className="dz-actions">
          <button className="btn primary" onClick={onPickFiles}>选择文件</button>
          <button className="btn ghost" onClick={onPickFolder}>选择文件夹</button>
        </div>
      </div>
    </div>
  )
}

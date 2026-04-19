'use client'

import { useRef, useState } from 'react'
import { Upload, Video, X, Download, Play, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Trash2 } from 'lucide-react'
import { useVideoStore, type OverlayConfig } from '@/lib/store'

const PRESETS: { id: string; name: string; config: Partial<OverlayConfig> }[] = [
  {
    id: 'triple-discount',
    name: 'Triple Discount',
    config: {
      style: 'banner',
      line1_text: 'TRIPLE DISCOUNT',
      line1_bg_color: '#FF69B4',
      line1_text_color: '#FFFFFF',
      line2_text: '4 HOURS LEFT',
      line2_bg_color: '#FF0000',
      line2_text_color: '#FFFFFF',
    },
  },
  {
    id: '40-off',
    name: '40% OFF',
    config: {
      style: 'banner',
      line1_text: '40% OFF',
      line1_bg_color: '#DD00FF',
      line1_text_color: '#FFFFFF',
      line2_text: '4 HOURS LEFT',
      line2_bg_color: '#FF0000',
      line2_text_color: '#FFFFFF',
    },
  },
  {
    id: 'ends-today',
    name: 'Ends Today',
    config: {
      style: 'banner',
      line1_text: 'TRIPLE DISCOUNT',
      line1_bg_color: '#FF0000',
      line1_text_color: '#FFFFFF',
      line2_text: 'ENDS TODAY',
      line2_bg_color: '#FFFFFF',
      line2_text_color: '#000000',
    },
  },
  {
    id: 'fulltext-waited',
    name: 'You Waited',
    config: {
      style: 'fulltext',
      text: 'If you waited until today you absolutely won because this is dirt cheap rn with free shipping',
    },
  },
]

function drawBannerOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, config: OverlayConfig) {
  const line1 = config.line1_text || 'SALE'
  const line2 = config.line2_text || ''
  const fontSize1 = Math.round(height * 0.042)
  const fontSize2 = Math.round(height * 0.032)
  const paddingX = Math.round(width * 0.035)
  const paddingY = Math.round(height * 0.01)
  const cornerRadius = Math.round(width * 0.018)
  const topOffset = height * 0.15
  const chipGap = height * 0.004

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  ctx.font = `bold ${fontSize1}px -apple-system, BlinkMacSystemFont, sans-serif`
  const text1Width = ctx.measureText(line1).width
  const chip1Width = text1Width + paddingX * 2
  const chip1Height = fontSize1 + paddingY * 2
  const chip1X = (width - chip1Width) / 2
  const chip1Y = topOffset

  ctx.fillStyle = config.line1_bg_color || '#FF0000'
  ctx.beginPath()
  ctx.roundRect(chip1X, chip1Y, chip1Width, chip1Height, cornerRadius)
  ctx.fill()

  ctx.fillStyle = config.line1_text_color || '#FFFFFF'
  ctx.fillText(line1, width / 2, chip1Y + chip1Height / 2)

  if (line2) {
    ctx.font = `bold ${fontSize2}px -apple-system, BlinkMacSystemFont, sans-serif`
    const text2Width = ctx.measureText(line2).width
    const chip2Width = text2Width + paddingX * 2
    const chip2Height = fontSize2 + paddingY * 2
    const chip2X = (width - chip2Width) / 2
    const chip2Y = chip1Y + chip1Height + chipGap

    ctx.fillStyle = config.line2_bg_color || '#FFFFFF'
    ctx.beginPath()
    ctx.roundRect(chip2X, chip2Y, chip2Width, chip2Height, cornerRadius)
    ctx.fill()

    ctx.fillStyle = config.line2_text_color || '#000000'
    ctx.fillText(line2, width / 2, chip2Y + chip2Height / 2)
  }
}

function drawFulltextOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, config: OverlayConfig) {
  const text = config.text || 'Your text here'
  const maxWidth = width * 0.85
  const fontSize = Math.round(height * 0.042)
  const lineHeight = fontSize * 1.25
  const strokeWidth = Math.max(3, Math.round(fontSize / 10))

  ctx.font = `900 ${fontSize}px "Arial Black", "Helvetica Neue", Arial, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)

  const totalHeight = lines.length * lineHeight
  const startY = height * 0.32 - totalHeight / 2 + lineHeight / 2

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = strokeWidth
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeText(lines[i], width / 2, y)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(lines[i], width / 2, y)
  }
}

async function processVideoClient(file: File, config: OverlayConfig, onProgress: (progress: number) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    const url = URL.createObjectURL(file)
    video.src = url

    video.oncanplaythrough = () => {
      const width = video.videoWidth || 720
      const height = video.videoHeight || 1280
      const duration = video.duration

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Could not create canvas context'))
        return
      }

      ctx.drawImage(video, 0, 0, width, height)
      if (config.style === 'banner') {
        drawBannerOverlay(ctx, width, height, config)
      } else {
        drawFulltextOverlay(ctx, width, height, config)
      }

      const stream = canvas.captureStream(30)
      const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
      const mimeType = mimeCandidates.find((candidate) => {
        try {
          return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)
        } catch {
          return false
        }
      }) || ''

      let recorder: MediaRecorder
      try {
        recorder = mimeType
          ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 })
          : new MediaRecorder(stream)
      } catch {
        try {
          recorder = new MediaRecorder(stream)
        } catch {
          URL.revokeObjectURL(url)
          reject(new Error('This browser does not support video export for this file'))
          return
        }
      }

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = () => {
        URL.revokeObjectURL(url)
        const finalMimeType = chunks[0]?.type || 'video/webm'
        resolve(new Blob(chunks, { type: finalMimeType }))
      }

      recorder.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Recording failed'))
      }

      let animationId = 0
      let isRecording = true

      const renderLoop = () => {
        if (!isRecording) return
        ctx.drawImage(video, 0, 0, width, height)
        if (config.style === 'banner') {
          drawBannerOverlay(ctx, width, height, config)
        } else {
          drawFulltextOverlay(ctx, width, height, config)
        }
        const progress = Math.min(99, Math.round((video.currentTime / duration) * 100))
        onProgress(progress)
        animationId = requestAnimationFrame(renderLoop)
      }

      video.onended = () => {
        isRecording = false
        cancelAnimationFrame(animationId)
        onProgress(100)
        recorder.stop()
      }

      video.onerror = () => {
        isRecording = false
        cancelAnimationFrame(animationId)
        URL.revokeObjectURL(url)
        reject(new Error('Video playback error'))
      }

      recorder.start(100)
      renderLoop()
      video.play().catch((err) => {
        isRecording = false
        cancelAnimationFrame(animationId)
        URL.revokeObjectURL(url)
        reject(new Error('Could not play video: ' + err.message))
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load video'))
    }
  })
}

function OverlayPreview({ config, className = '' }: { config: OverlayConfig; className?: string }) {
  if (config.style === 'banner') {
    return (
      <div className={`absolute inset-0 pointer-events-none ${className}`}>
        <div className="absolute top-[15%] left-0 right-0 flex flex-col items-center gap-0.5">
          <div className="px-4 py-1.5 rounded-xl text-sm font-bold" style={{ backgroundColor: config.line1_bg_color, color: config.line1_text_color }}>
            {config.line1_text || 'Line 1'}
          </div>
          {config.line2_text && (
            <div className="px-3 py-1 rounded-xl text-xs font-bold" style={{ backgroundColor: config.line2_bg_color, color: config.line2_text_color }}>
              {config.line2_text}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <div className="absolute top-[25%] left-0 right-0 px-3">
        <p
          className="text-center text-sm font-black leading-tight"
          style={{
            color: '#FFFFFF',
            textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000',
            fontFamily: '"Arial Black", "Helvetica Neue", Arial, sans-serif',
            lineHeight: '1.25',
          }}
        >
          {config.text || 'Your text here'}
        </p>
      </div>
    </div>
  )
}

export default function Home() {
  const [step, setStep] = useState<'upload' | 'configure' | 'process' | 'done'>('upload')
  const [selectedPreset, setSelectedPreset] = useState<string>('triple-discount')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    videos,
    overlayConfig,
    addVideos,
    removeVideo,
    clearVideos,
    setOverlayConfig,
    setVideoStatus,
    setVideoProcessed,
    setVideoError,
    setIsProcessing,
    resetProcessing,
  } = useVideoStore()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addVideos(e.target.files)
      setStep('configure')
    }
    e.target.value = ''
  }

  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId)
    const preset = PRESETS.find((p) => p.id === presetId)
    if (preset) setOverlayConfig(preset.config)
  }

  const handleProcessAll = async () => {
    setStep('process')
    setIsProcessing(true)

    for (const video of videos) {
      setVideoStatus(video.id, 'processing', 0)
      try {
        const processedBlob = await processVideoClient(video.file, overlayConfig, (progress) => {
          setVideoStatus(video.id, 'processing', progress)
        })
        const processedUrl = URL.createObjectURL(processedBlob)
        setVideoProcessed(video.id, processedUrl, processedBlob)
      } catch (error) {
        setVideoError(video.id, error instanceof Error ? error.message : 'Processing failed')
      }
    }

    setIsProcessing(false)
    setStep('done')
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownload = (video: (typeof videos)[0]) => {
    if (!video.processedBlob) return
    const ext = video.processedBlob.type.includes('mp4') ? '.mp4' : '.webm'
    const filename = `edited_${video.name.replace(/\.[^.]+$/, '')}${ext}`

    if (navigator.share && navigator.canShare) {
      const file = new File([video.processedBlob], filename, { type: video.processedBlob.type })
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(() => downloadBlob(video.processedBlob!, filename))
        return
      }
    }

    downloadBlob(video.processedBlob, filename)
  }

  const handleDownloadAll = () => {
    videos.filter((v) => v.status === 'completed').forEach(handleDownload)
  }

  const handleNewBatch = () => {
    clearVideos()
    setStep('upload')
  }

  const completedCount = videos.filter((v) => v.status === 'completed').length
  const errorCount = videos.filter((v) => v.status === 'error').length

  return (
    <main className="min-h-screen p-4 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <Video className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-lg">VidBot</span>
        </div>
        {videos.length > 0 && (
          <span className="text-sm text-[var(--muted-foreground)]">{videos.length} video{videos.length !== 1 ? 's' : ''}</span>
        )}
      </header>

      {step === 'upload' && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Batch Edit Videos</h1>
            <p className="text-[var(--muted-foreground)]">Add text overlays to multiple videos at once</p>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--border)] rounded-2xl p-8 text-center cursor-pointer hover:border-[var(--primary)] transition-colors active:bg-[var(--card)]"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--muted-foreground)]" />
            <p className="font-medium mb-1">Tap to select videos</p>
            <p className="text-sm text-[var(--muted-foreground)]">MP4, MOV, WebM supported</p>
          </div>
        </div>
      )}

      {step === 'configure' && (
        <div className="space-y-6">
          <button onClick={() => setStep('upload')} className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] min-h-[44px]">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold">Configure Overlay</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Select a preset or customize your text</p>
          </div>

          <div className="relative aspect-[9/16] max-h-[300px] mx-auto bg-black rounded-xl overflow-hidden">
            {videos[0] && (
              <>
                <video src={videos[0].url} className="w-full h-full object-cover" muted playsInline autoPlay loop />
                <OverlayPreview config={overlayConfig} />
              </>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Presets</h3>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`p-3 rounded-xl text-left text-sm font-medium transition-colors min-h-[44px] ${selectedPreset === preset.id ? 'bg-[var(--primary)] text-black' : 'bg-[var(--card)] hover:bg-[var(--muted)] active:bg-[var(--muted)]'}`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Custom Text</h3>
            {overlayConfig.style === 'banner' ? (
              <div className="space-y-2">
                <input type="text" value={overlayConfig.line1_text} onChange={(e) => setOverlayConfig({ line1_text: e.target.value })} placeholder="Line 1 text" className="w-full p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-base min-h-[44px]" />
                <input type="text" value={overlayConfig.line2_text} onChange={(e) => setOverlayConfig({ line2_text: e.target.value })} placeholder="Line 2 text (optional)" className="w-full p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-base min-h-[44px]" />
              </div>
            ) : (
              <textarea value={overlayConfig.text} onChange={(e) => setOverlayConfig({ text: e.target.value })} placeholder="Enter your fullscreen text..." rows={3} className="w-full p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-base resize-none" />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[var(--muted-foreground)]">Videos ({videos.length})</h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {videos.map((video) => (
                <div key={video.id} className="flex items-center gap-3 p-2 rounded-xl bg-[var(--card)]">
                  <div className="w-12 h-12 rounded-lg bg-black overflow-hidden flex-shrink-0">
                    <video src={video.url} className="w-full h-full object-cover" muted playsInline />
                  </div>
                  <span className="flex-1 text-sm truncate">{video.name}</span>
                  <button onClick={() => removeVideo(video.id)} className="p-2 text-[var(--muted-foreground)] hover:text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="w-full p-3 rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--muted-foreground)] hover:border-[var(--primary)] min-h-[44px]">
              + Add more videos
            </button>
          </div>

          <button onClick={handleProcessAll} disabled={videos.length === 0} className="w-full p-4 rounded-xl bg-[var(--primary)] text-black font-bold text-lg disabled:opacity-50 min-h-[56px]">
            Process {videos.length} Video{videos.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {step === 'process' && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-[var(--primary)]" />
            <h1 className="text-xl font-bold">Processing Videos</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Keep this page open while processing...</p>
          </div>

          <div className="space-y-3">
            {videos.map((video) => (
              <div key={video.id} className="p-4 rounded-xl bg-[var(--card)] space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-black overflow-hidden flex-shrink-0">
                    <video src={video.url} className="w-full h-full object-cover" muted playsInline />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{video.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{video.status === 'processing' ? `${video.progress}%` : video.status === 'completed' ? 'Done' : video.status === 'error' ? video.error || 'Failed' : 'Waiting...'}</p>
                  </div>
                  {video.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-[var(--primary)]" />}
                  {video.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                  {video.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />}
                </div>
                {video.status === 'processing' && (
                  <div className="h-1 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--primary)] transition-all duration-300" style={{ width: `${video.progress}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <CheckCircle2 className="w-16 h-16 mx-auto text-[var(--primary)]" />
            <h1 className="text-xl font-bold">Processing Complete</h1>
            <p className="text-sm text-[var(--muted-foreground)]">{completedCount} video{completedCount !== 1 ? 's' : ''} ready to download{errorCount > 0 && `, ${errorCount} failed`}</p>
          </div>

          <div className="space-y-3">
            {videos.map((video) => (
              <div key={video.id} className="p-4 rounded-xl bg-[var(--card)]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-black overflow-hidden flex-shrink-0 relative">
                    <video src={video.processedUrl || video.url} className="w-full h-full object-cover" muted playsInline />
                    {video.status === 'completed' && <div className="absolute inset-0 flex items-center justify-center bg-black/30"><Play className="w-5 h-5 text-white" /></div>}
                    {video.status === 'error' && <div className="absolute inset-0 flex items-center justify-center bg-red-500/30"><AlertCircle className="w-5 h-5 text-white" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{video.name}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">{video.status === 'completed' ? 'Ready' : video.error || 'Failed'}</p>
                  </div>
                  {video.status === 'completed' && (
                    <button onClick={() => handleDownload(video)} className="p-2 rounded-lg bg-[var(--primary)] text-black min-w-[44px] min-h-[44px] flex items-center justify-center">
                      <Download className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { resetProcessing(); setStep('configure') }} className="flex-1 p-4 rounded-xl bg-[var(--card)] font-medium min-h-[56px]">Edit Again</button>
            <button onClick={handleNewBatch} className="flex-1 p-4 rounded-xl bg-[var(--card)] font-medium flex items-center justify-center gap-2 min-h-[56px]">
              <Trash2 className="w-4 h-4" />
              New Batch
            </button>
          </div>

          {completedCount > 0 && (
            <button onClick={handleDownloadAll} className="w-full p-4 rounded-xl bg-[var(--primary)] text-black font-bold min-h-[56px]">Download All ({completedCount})</button>
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" multiple accept="video/*" onChange={handleFileSelect} className="hidden" />
    </main>
  )
}

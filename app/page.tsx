'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Play,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { useVideoStore, type OverlayConfig } from '@/lib/store'
import {
  canRecoverBatch,
  clearBatchState,
  createBatch,
  getCompletedVideos,
  loadBatchState,
  saveBatchState,
  type BatchState,
} from '@/lib/batch-manager'

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

      const stream = canvas.captureStream(30)
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = () => {
        URL.revokeObjectURL(url)
        resolve(new Blob(chunks, { type: chunks[0]?.type || 'video/webm' }))
      }
      recorder.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Recording failed'))
      }

      let animationId = 0
      const renderLoop = () => {
        ctx.drawImage(video, 0, 0, width, height)
        drawBannerOverlay(ctx, width, height, config)
        onProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)))
        animationId = requestAnimationFrame(renderLoop)
      }

      video.onended = () => {
        cancelAnimationFrame(animationId)
        onProgress(100)
        recorder.stop()
      }

      recorder.start(100)
      renderLoop()
      video.play().catch((err) => reject(new Error(`Could not play video: ${err.message}`)))
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load video'))
    }
  })
}

async function uploadProcessedVideo(blob: Blob, filename: string): Promise<string> {
  const response = await fetch('/api/upload-processed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': encodeURIComponent(filename),
    },
    body: blob,
  })

  if (!response.ok) {
    throw new Error('Failed to upload processed video')
  }

  const data = (await response.json()) as { url: string }
  return data.url
}

export default function Home() {
  const [step, setStep] = useState<'upload' | 'configure' | 'process' | 'done'>('upload')
  const [selectedPreset, setSelectedPreset] = useState('triple-discount')
  const [batchState, setBatchState] = useState<BatchState | null>(null)
  const [recoveredBatch, setRecoveredBatch] = useState<BatchState | null>(null)
  const [isDownloadingAll, setIsDownloadingAll] = useState(false)
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
    setVideoBlobUrl,
    setVideoError,
    setIsProcessing,
    resetProcessing,
  } = useVideoStore()

  useEffect(() => {
    if (canRecoverBatch()) {
      setRecoveredBatch(loadBatchState())
    }
  }, [])

  const completedCount = useMemo(() => videos.filter((v) => v.status === 'completed').length, [videos])

  const handleProcessAll = async () => {
    setStep('process')
    setIsProcessing(true)

    const newBatch = createBatch(
      videos.map((v) => v.name),
      { overlayPreset: selectedPreset, musicEnabled: false }
    )

    setBatchState(newBatch)

    for (let index = 0; index < videos.length; index++) {
      const video = videos[index]
      const batchVideo = newBatch.videos[index]
      setVideoStatus(video.id, 'processing', 0)

      try {
        const processedBlob = await processVideoClient(video.file, overlayConfig, (progress) => {
          setVideoStatus(video.id, 'processing', progress)
          const current = loadBatchState()
          if (current && current.id === newBatch.id) {
            current.videos[index] = { ...current.videos[index], status: 'processing', progress }
            saveBatchState(current)
            setBatchState(current)
          }
        })

        const processedUrl = URL.createObjectURL(processedBlob)
        setVideoProcessed(video.id, processedUrl, processedBlob)

        const blobUrl = await uploadProcessedVideo(processedBlob, video.name)
        setVideoBlobUrl(video.id, blobUrl)

        const current = loadBatchState()
        if (current && current.id === newBatch.id) {
          current.videos[index] = {
            ...current.videos[index],
            status: 'completed',
            progress: 100,
            blobUrl,
            localUrl: processedUrl,
            processedAt: Date.now(),
          }
          saveBatchState(current)
          setBatchState(current)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Processing failed'
        setVideoError(video.id, message)

        const current = loadBatchState()
        if (current && current.id === newBatch.id) {
          current.videos[index] = {
            ...current.videos[index],
            status: 'error',
            error: message,
          }
          saveBatchState(current)
          setBatchState(current)
        }
      }
    }

    setIsProcessing(false)
    setStep('done')
    setRecoveredBatch(loadBatchState())
  }

  const handleDownloadAll = async () => {
    const sourceBatch = batchState ?? recoveredBatch ?? loadBatchState()
    if (!sourceBatch) return

    const completed = getCompletedVideos(sourceBatch)
    if (completed.length === 0) {
      alert('No completed videos available in durable storage yet.')
      return
    }

    setIsDownloadingAll(true)
    try {
      const response = await fetch('/api/download-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videos: completed.map((video) => ({ name: video.name, url: video.blobUrl! })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create ZIP')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `vidbot_batch_${Date.now()}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Batch download failed')
    } finally {
      setIsDownloadingAll(false)
    }
  }

  const handleClearRecovered = () => {
    clearBatchState()
    setRecoveredBatch(null)
  }

  return (
    <main className="min-h-screen p-4 pb-24">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <Video className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-lg">VidBot</span>
        </div>
      </header>

      {step === 'upload' && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Batch Edit Videos</h1>
            <p className="text-[var(--muted-foreground)]">Upload videos and export from durable storage</p>
          </div>

          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-[var(--border)] rounded-2xl p-8 text-center cursor-pointer">
            <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--muted-foreground)]" />
            <p className="font-medium mb-1">Tap to select videos</p>
            <p className="text-sm text-[var(--muted-foreground)]">MP4, MOV, WebM supported</p>
          </div>
        </div>
      )}

      {step === 'configure' && (
        <div className="space-y-6">
          <button onClick={() => setStep('upload')} className="flex items-center gap-2 text-[var(--muted-foreground)]">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="space-y-2">
            <h1 className="text-xl font-bold">Overlay Preset</h1>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setSelectedPreset(preset.id)
                    setOverlayConfig(preset.config)
                  }}
                  className={`p-3 rounded-xl text-left text-sm font-medium ${selectedPreset === preset.id ? 'bg-[var(--primary)] text-black' : 'bg-[var(--card)]'}`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {videos.map((video) => (
              <div key={video.id} className="flex items-center gap-3 p-2 rounded-xl bg-[var(--card)]">
                <span className="flex-1 text-sm truncate">{video.name}</span>
                <button onClick={() => removeVideo(video.id)} className="p-2 text-[var(--muted-foreground)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button onClick={handleProcessAll} disabled={videos.length === 0} className="w-full p-4 rounded-xl bg-[var(--primary)] text-black font-bold">
            Process {videos.length} Video{videos.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {step === 'process' && (
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-[var(--primary)]" />
            <h1 className="text-xl font-bold">Processing + Uploading</h1>
          </div>

          {videos.map((video) => (
            <div key={video.id} className="p-4 rounded-xl bg-[var(--card)] space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{video.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {video.status === 'processing' ? `${video.progress}%` : video.status}
                  </p>
                </div>
                {video.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-[var(--primary)]" />}
                {video.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                {video.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <CheckCircle2 className="w-16 h-16 mx-auto text-[var(--primary)]" />
            <h1 className="text-xl font-bold">Processing Complete</h1>
            <p className="text-sm text-[var(--muted-foreground)]">{completedCount} video(s) uploaded to durable storage</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { resetProcessing(); setStep('configure') }} className="flex-1 p-4 rounded-xl bg-[var(--card)] font-medium">Edit Again</button>
            <button onClick={() => { clearVideos(); setStep('upload'); clearBatchState(); setBatchState(null) }} className="flex-1 p-4 rounded-xl bg-[var(--card)] font-medium flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> New Batch
            </button>
          </div>

          <button onClick={handleDownloadAll} disabled={isDownloadingAll} className="w-full p-4 rounded-xl bg-[var(--primary)] text-black font-bold flex items-center justify-center gap-2">
            {isDownloadingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {isDownloadingAll ? 'Building ZIP…' : `Download All (${completedCount})`}
          </button>

          {recoveredBatch && (
            <button type="button" onClick={handleClearRecovered} className="w-full p-3 rounded-xl bg-[var(--card)] font-medium text-sm">
              Start New Batch
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            addVideos(e.target.files)
            setStep('configure')
          }
          e.target.value = ''
        }}
        className="hidden"
      />
    </main>
  )
}

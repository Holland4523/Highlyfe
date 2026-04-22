'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { useVideoStore, type MusicTrack, type OverlayConfig } from '@/lib/store'
import { assignTracksToVideos } from '@/lib/music-library'
import {
  canRecoverBatch,
  clearBatchState,
  createBatch,
  getCompletedVideos,
  loadBatchState,
  saveBatchState,
  type BatchState,
} from '@/lib/batch-manager'

const UI_STATE_KEY = 'vidbot_ui_state'
const MAX_BATCH_VIDEOS = 20

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
  const topOffset = height * 0.2
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
    const chip2Y = chip1Y + chip1Height + chipGap

    ctx.fillStyle = config.line2_bg_color || '#FFFFFF'
    ctx.beginPath()
    ctx.roundRect((width - chip2Width) / 2, chip2Y, chip2Width, chip2Height, cornerRadius)
    ctx.fill()

    ctx.fillStyle = config.line2_text_color || '#000000'
    ctx.fillText(line2, width / 2, chip2Y + chip2Height / 2)
  }
}

function drawFulltextOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, config: OverlayConfig) {
  const text = config.text || 'Your text here'
  const fontSize = Math.round(height * 0.042)
  const maxWidth = width * 0.85
  const lineHeight = fontSize * 1.25

  ctx.font = `900 ${fontSize}px "Arial Black", "Helvetica Neue", Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const words = text.split(' ')
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)

  const totalHeight = lines.length * lineHeight
  const startY = height * 0.28 - totalHeight / 2 + lineHeight / 2

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight
    ctx.lineWidth = Math.max(3, Math.round(fontSize / 10))
    ctx.strokeStyle = '#000000'
    ctx.strokeText(lines[i], width / 2, y)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(lines[i], width / 2, y)
  }
}

async function processVideoClient(
  file: File,
  config: OverlayConfig,
  options: { musicUrl?: string; musicVolume: number; musicSpeed: number },
  onProgress: (progress: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    const inputUrl = URL.createObjectURL(file)
    video.src = inputUrl

    video.oncanplaythrough = async () => {
      const sourceWidth = video.videoWidth || 720
      const sourceHeight = video.videoHeight || 1280
      const scale = sourceWidth * sourceHeight > 1280 * 720 ? 0.75 : 1
      const width = Math.round(720 * scale)
      const height = Math.round(1280 * scale)
      const videoDuration = Math.max(video.duration, 0.1)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(inputUrl)
        reject(new Error('Could not create canvas context'))
        return
      }

      const canvasStream = canvas.captureStream(24)
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'
      const audioContext = new AudioContext()
      const destination = audioContext.createMediaStreamDestination()
      const videoSource = audioContext.createMediaElementSource(video)
      const videoGain = audioContext.createGain()
      videoGain.gain.value = 1
      videoSource.connect(videoGain).connect(destination)

      let bgAudio: HTMLAudioElement | null = null
      let bgAudioDuration = Number.POSITIVE_INFINITY
      if (options.musicUrl) {
        try {
          bgAudio = new Audio(options.musicUrl)
          bgAudio.crossOrigin = 'anonymous'
          bgAudio.loop = true
          bgAudio.preload = 'auto'
          bgAudio.playbackRate = options.musicSpeed
          await new Promise<void>((resolve, reject) => {
            bgAudio!.onloadedmetadata = () => {
              bgAudioDuration = (bgAudio!.duration || 0) / options.musicSpeed
              resolve()
            }
            bgAudio!.onerror = () => reject(new Error('Failed to load track metadata'))
          })
          const musicSource = audioContext.createMediaElementSource(bgAudio)
          const musicGain = audioContext.createGain()
          musicGain.gain.value = Math.max(0, Math.min(1, options.musicVolume))
          musicSource.connect(musicGain).connect(destination)
        } catch {
          bgAudio = null
        }
      }

      const mixedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ])
      const targetDuration = Math.min(videoDuration, bgAudioDuration)

      const recorder = new MediaRecorder(mixedStream, { mimeType, videoBitsPerSecond: 3_500_000 })
      const chunks: Blob[] = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }

      recorder.onerror = () => {
        audioContext.close().catch(() => undefined)
        URL.revokeObjectURL(inputUrl)
        reject(new Error('Recording failed'))
      }

      recorder.onstop = () => {
        if (bgAudio) {
          bgAudio.pause()
          bgAudio.src = ''
        }
        audioContext.close().catch(() => undefined)
        URL.revokeObjectURL(inputUrl)
        resolve(new Blob(chunks, { type: chunks[0]?.type || 'video/webm' }))
      }

      let animationFrame = 0
      const drawFrame = () => {
        const drawWidth = sourceWidth
        const drawHeight = sourceHeight
        const sourceAspect = drawWidth / drawHeight
        const targetAspect = width / height

        if (sourceAspect > targetAspect) {
          const newWidth = drawHeight * targetAspect
          const sx = (drawWidth - newWidth) / 2
          ctx.drawImage(video, sx, 0, newWidth, drawHeight, 0, 0, width, height)
        } else {
          const newHeight = drawWidth / targetAspect
          const sy = (drawHeight - newHeight) / 2
          ctx.drawImage(video, 0, sy, drawWidth, newHeight, 0, 0, width, height)
        }

        if (config.style === 'fulltext') {
          drawFulltextOverlay(ctx, width, height, config)
        } else {
          drawBannerOverlay(ctx, width, height, config)
        }

        onProgress(Math.min(99, Math.round((video.currentTime / targetDuration) * 100)))
        animationFrame = requestAnimationFrame(drawFrame)
      }

      const finish = () => {
        cancelAnimationFrame(animationFrame)
        onProgress(100)
        recorder.stop()
      }
      video.onended = finish
      const stopper = window.setInterval(() => {
        if (video.currentTime >= targetDuration) {
          clearInterval(stopper)
          finish()
        }
      }, 80)

      recorder.start(150)
      drawFrame()
      Promise.all([
        audioContext.resume().catch(() => undefined),
        bgAudio ? bgAudio.play().catch(() => undefined) : Promise.resolve(),
        video.play(),
      ]).catch((error) => {
        clearInterval(stopper)
        cancelAnimationFrame(animationFrame)
        audioContext.close().catch(() => undefined)
        URL.revokeObjectURL(inputUrl)
        reject(new Error(`Could not play video: ${error.message}`))
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(inputUrl)
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
    throw new Error('Upload failed')
  }

  const data = (await response.json()) as { url: string }
  return data.url
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'configure' | 'process' | 'done'>('upload')
  const [selectedPreset, setSelectedPreset] = useState('triple-discount')
  const [batchState, setBatchState] = useState<BatchState | null>(null)
  const [recoveredBatch, setRecoveredBatch] = useState<BatchState | null>(null)
  const [isDownloadingAll, setIsDownloadingAll] = useState(false)
  const [statusText, setStatusText] = useState<string>('')
  const [isIosSafari, setIsIosSafari] = useState(false)
  const [needsManualZipTap, setNeedsManualZipTap] = useState(false)
  const [pendingZipUrl, setPendingZipUrl] = useState<string | null>(null)
  const [resumeNotice, setResumeNotice] = useState<string>('')

  const {
    videos,
    overlayConfig,
    musicConfig,
    addVideos,
    removeVideo,
    clearVideos,
    setOverlayConfig,
    setMusicConfig,
    setVideoStatus,
    setVideoProcessed,
    setVideoBlobUrl,
    setVideoError,
    setIsProcessing,
    resetProcessing,
  } = useVideoStore()

  useEffect(() => {
    const ua = navigator.userAgent
    const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
    setIsIosSafari(isiOS && isSafari)
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(UI_STATE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as { step?: typeof step; selectedPreset?: string }
        if (parsed.selectedPreset) setSelectedPreset(parsed.selectedPreset)
        if (parsed.step && parsed.step !== 'process') setStep(parsed.step)
      }
    } catch {
      // ignore
    }

    if (canRecoverBatch()) {
      const loaded = loadBatchState()
      setRecoveredBatch(loaded)
      if (loaded && getCompletedVideos(loaded).length > 0) {
        setStep('done')
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify({ step, selectedPreset }))
  }, [step, selectedPreset])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && batchState) {
        saveBatchState(batchState)
        if (step === 'process') {
          setResumeNotice('App was backgrounded. Processing may pause on iOS; reopen to continue or recover finished uploads.')
        }
      } else if (!document.hidden && step === 'process') {
        setResumeNotice('Welcome back — if processing paused, keep this tab open to continue.')
      }
    }

    const onBeforeUnload = () => {
      if (batchState) saveBatchState(batchState)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [batchState])

  const completedCount = useMemo(() => videos.filter((video) => video.status === 'completed').length, [videos])

  const handlePresetSelect = (presetId: string) => {
    setSelectedPreset(presetId)
    const preset = PRESETS.find((item) => item.id === presetId)
    if (preset) {
      setOverlayConfig(preset.config)
    }
  }

  const handleProcessAll = async () => {
    setStep('process')
    setStatusText('Processing videos…')
    setIsProcessing(true)

    const newBatch = createBatch(
      videos.map((video) => video.name),
      {
        overlayPreset: selectedPreset,
        musicEnabled: musicConfig.enabled,
        seed: `seed_${Date.now()}`,
      }
    )

    setBatchState(newBatch)
    console.info('[batch] start', { batchId: newBatch.id, files: videos.length })
    const trackAssignments: Record<string, MusicTrack> = musicConfig.enabled
      ? assignTracksToVideos(
          videos.map((item) => item.id),
          musicConfig.style,
          newBatch.config.seed
        )
      : ({} as Record<string, MusicTrack>)

    for (let index = 0; index < videos.length; index++) {
      const video = videos[index]
      const batchVideo = newBatch.videos[index]

      setVideoStatus(video.id, 'processing', 0)
      console.info('[batch] file start', { batchId: newBatch.id, videoId: video.id, name: video.name })

      try {
        const processedBlob = await processVideoClient(
          video.file,
          overlayConfig,
          {
            musicUrl: trackAssignments[video.id]?.url,
            musicVolume: musicConfig.volume,
            musicSpeed: 1.3,
          },
          (progress) => {
          setVideoStatus(video.id, 'processing', progress)

          const current = loadBatchState()
          if (current && current.id === newBatch.id) {
            current.videos[index] = {
              ...batchVideo,
              status: 'processing',
              progress,
            }
            saveBatchState(current)
            setBatchState(current)
          }
          }
        )

        setStatusText(`Uploading ${video.name}…`)
        const localUrl = URL.createObjectURL(processedBlob)
        setVideoProcessed(video.id, localUrl, processedBlob)

        const blobUrl = await uploadProcessedVideo(processedBlob, video.name)
        setVideoBlobUrl(video.id, blobUrl)

        const current = loadBatchState()
        if (current && current.id === newBatch.id) {
          current.videos[index] = {
            ...current.videos[index],
            status: 'completed',
            progress: 100,
            blobUrl,
            localUrl,
            processedAt: Date.now(),
            assignedTrackId: trackAssignments[video.id]?.id,
          }
          console.info('[batch] file complete', { batchId: newBatch.id, videoId: video.id, blobUrl })
          saveBatchState(current)
          setBatchState(current)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Processing failed'
        console.error('[batch] file failed', { batchId: newBatch.id, videoId: video.id, message })
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

    setStatusText('All items processed')
    setIsProcessing(false)
    setStep('done')
      setRecoveredBatch(loadBatchState())
      if (resumeNotice) {
        setTimeout(() => setResumeNotice(''), 5000)
      }
  }

  const handleDownloadAll = async () => {
    const source = batchState ?? recoveredBatch ?? loadBatchState()
    if (!source) {
      alert('No saved batch found.')
      return
    }

    const completedVideos = getCompletedVideos(source)
    if (completedVideos.length === 0) {
      alert('No completed uploads are available yet.')
      return
    }

    setIsDownloadingAll(true)
    console.info('[batch] zip build start', { batchId: source.id, count: completedVideos.length })
    try {
      source.zipStatus = 'building'
      saveBatchState(source)
      const response = await fetch('/api/download-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videos: completedVideos.map((video) => ({
            name: video.name,
            url: video.blobUrl!,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('ZIP generation failed')
      }

      const zipBlob = await response.blob()
      const zipUrl = URL.createObjectURL(zipBlob)
      source.zipStatus = 'ready'
      source.zipUrl = zipUrl
      saveBatchState(source)
      console.info('[batch] zip ready', { batchId: source.id, size: zipBlob.size })
      if (isIosSafari) {
        setPendingZipUrl(zipUrl)
        setNeedsManualZipTap(true)
      } else {
        const anchor = document.createElement('a')
        anchor.href = zipUrl
        anchor.download = `vidbot_batch_${Date.now()}.zip`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(zipUrl)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Download failed')
    } finally {
      setIsDownloadingAll(false)
    }
  }

  const handleNewBatch = () => {
    clearVideos()
    clearBatchState()
    localStorage.removeItem(UI_STATE_KEY)
    if (pendingZipUrl) URL.revokeObjectURL(pendingZipUrl)
    setPendingZipUrl(null)
    setNeedsManualZipTap(false)
    setResumeNotice('')
    setBatchState(null)
    setRecoveredBatch(null)
    setStatusText('')
    setStep('upload')
  }

  return (
    <main className="min-h-screen p-4 pb-24 max-w-md mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center">
            <Video className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-lg">VidBot</span>
        </div>
        {videos.length > 0 && (
          <span className="text-xs text-[var(--muted-foreground)]">{videos.length} file{videos.length !== 1 ? 's' : ''}</span>
        )}
      </header>

      {recoveredBatch && step !== 'process' && (
        <div className="mb-4 rounded-xl border border-[var(--border)] p-3 bg-[var(--card)]">
          <p className="text-sm font-medium mb-1">Recovered saved batch</p>
          <p className="text-xs text-[var(--muted-foreground)] mb-3">
            {getCompletedVideos(recoveredBatch).length} completed upload(s) can still be downloaded.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setStep('done')} className="flex-1 min-h-[44px] rounded-lg bg-[var(--primary)] text-black text-sm font-semibold">
              Open Batch
            </button>
            <button onClick={handleNewBatch} className="flex-1 min-h-[44px] rounded-lg bg-[var(--muted)] text-sm font-semibold">
              Start Fresh
            </button>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Batch Edit Videos</h1>
            <p className="text-[var(--muted-foreground)] text-sm">Durable upload + server ZIP for stable mobile downloads</p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-[var(--border)] rounded-2xl p-8 text-center min-h-[180px]"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--muted-foreground)]" />
            <p className="font-medium mb-1">Tap to select videos</p>
            <p className="text-sm text-[var(--muted-foreground)]">MP4, MOV, WebM</p>
          </button>
        </section>
      )}

      {step === 'configure' && (
        <section className="space-y-5">
          <button onClick={() => setStep('upload')} className="flex items-center gap-2 text-[var(--muted-foreground)] min-h-[44px]">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="space-y-2">
            <h2 className="font-semibold">Choose Preset</h2>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`text-left p-3 rounded-xl min-h-[44px] text-sm ${selectedPreset === preset.id ? 'bg-[var(--primary)] text-black' : 'bg-[var(--card)]'}`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-[var(--card)] p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-sm">Voice Track</h2>
              <button
                type="button"
                onClick={() => setMusicConfig({ enabled: !musicConfig.enabled })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  musicConfig.enabled ? 'bg-emerald-500 text-black' : 'bg-[var(--muted)]'
                }`}
              >
                {musicConfig.enabled ? 'On' : 'Off'}
              </button>
            </div>
            {musicConfig.enabled && (
              <div className="space-y-2">
                <label className="text-xs text-[var(--muted-foreground)]">
                  Volume: {Math.round(musicConfig.volume * 100)}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={musicConfig.volume}
                  onChange={(event) => setMusicConfig({ volume: Number(event.target.value) })}
                  className="w-full"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold">Files ({videos.length})</h2>
            <div className="space-y-2 max-h-[35vh] overflow-y-auto">
              {videos.map((video) => (
                <div key={video.id} className="p-3 rounded-xl bg-[var(--card)] flex items-center gap-3">
                  <span className="flex-1 truncate text-sm">{video.name}</span>
                  <button onClick={() => removeVideo(video.id)} className="min-w-[44px] min-h-[44px] text-[var(--muted-foreground)]">
                    <X className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleProcessAll} disabled={videos.length === 0} className="w-full min-h-[52px] rounded-xl bg-[var(--primary)] text-black font-bold disabled:opacity-50">
            Process {videos.length} Video{videos.length !== 1 ? 's' : ''}
          </button>
        </section>
      )}

      {step === 'process' && (
        <section className="space-y-4">
          <div className="text-center space-y-2">
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-[var(--primary)]" />
            <h2 className="text-xl font-bold">Processing</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{statusText || 'Keep app open for best results'}</p>
            {resumeNotice && <p className="text-xs text-amber-400">{resumeNotice}</p>}
          </div>

          <div className="space-y-2">
            {videos.map((video) => (
              <div key={video.id} className="p-3 rounded-xl bg-[var(--card)]">
                <div className="flex items-center gap-3">
                  <span className="flex-1 truncate text-sm">{video.name}</span>
                  {video.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-[var(--primary)]" />}
                  {video.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                  {video.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin" />}
                </div>
                <div className="mt-2 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--primary)]" style={{ width: `${video.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {step === 'done' && (
        <section className="space-y-4">
          <div className="text-center space-y-2">
            <CheckCircle2 className="w-14 h-14 mx-auto text-[var(--primary)]" />
            <h2 className="text-xl font-bold">Batch Ready</h2>
            <p className="text-sm text-[var(--muted-foreground)]">{completedCount} local completed · durable URLs saved for recovery</p>
          </div>

          <button
            onClick={handleDownloadAll}
            disabled={isDownloadingAll}
            className="w-full min-h-[52px] rounded-xl bg-[var(--primary)] text-black font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isDownloadingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {isDownloadingAll ? 'Building ZIP…' : 'Download All'}
          </button>

          {isIosSafari && (
            <p className="text-xs text-[var(--muted-foreground)] text-center">
              iPhone/iPad tip: if download doesn’t auto-start, use the manual button below.
            </p>
          )}

          {needsManualZipTap && pendingZipUrl && (
            <a
              href={pendingZipUrl}
              download={`vidbot_batch_${Date.now()}.zip`}
              onClick={() => {
                setNeedsManualZipTap(false)
                setTimeout(() => {
                  URL.revokeObjectURL(pendingZipUrl)
                  setPendingZipUrl(null)
                }, 1200)
              }}
              className="w-full min-h-[52px] rounded-xl bg-emerald-500 text-black font-bold flex items-center justify-center"
            >
              Tap to Download ZIP
            </a>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                resetProcessing()
                setStep('configure')
              }}
              className="flex-1 min-h-[48px] rounded-xl bg-[var(--card)] font-medium"
            >
              Edit Again
            </button>
            <button onClick={handleNewBatch} className="flex-1 min-h-[48px] rounded-xl bg-[var(--card)] font-medium flex items-center justify-center gap-2">
              <Trash2 className="w-4 h-4" /> New Batch
            </button>
          </div>
        </section>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*"
        className="hidden"
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            const existing = videos.length
            const incoming = Array.from(event.target.files)
            const allowed = incoming.filter((file) => file.type.startsWith('video/'))
            const remainingSlots = Math.max(0, MAX_BATCH_VIDEOS - existing)
            const selected = allowed.slice(0, remainingSlots)

            if (selected.length === 0) {
              alert(`Batch limit reached (${MAX_BATCH_VIDEOS} videos max).`)
              event.target.value = ''
              return
            }

            if (allowed.length !== incoming.length) {
              alert('Some files were skipped because they are not video files.')
            }
            if (selected.length < allowed.length) {
              alert(`Only first ${remainingSlots} files were added (max ${MAX_BATCH_VIDEOS} per batch).`)
            }

            addVideos(selected)
            setStep('configure')
          }
          event.target.value = ''
        }}
      />
    </main>
  )
}

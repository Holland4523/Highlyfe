export interface BatchVideo {
  id: string
  name: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  error?: string
  blobUrl?: string
  localUrl?: string
  processedAt?: number
}

export interface BatchState {
  id: string
  videos: BatchVideo[]
  createdAt: number
  updatedAt: number
  config: {
    overlayPreset: string
    musicEnabled: boolean
  }
}

const STORAGE_KEY = 'vidbot_batch_state'
const TTL_MS = 24 * 60 * 60 * 1000

export function loadBatchState(): BatchState | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const state = JSON.parse(stored) as BatchState

    if (Date.now() - state.createdAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return state
  } catch {
    return null
  }
}

export function saveBatchState(state: BatchState): void {
  if (typeof window === 'undefined') return
  try {
    state.updatedAt = Date.now()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore localStorage failures
  }
}

export function clearBatchState(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function createBatch(videoNames: string[], config: BatchState['config']): BatchState {
  const now = Date.now()
  const batch: BatchState = {
    id: `batch_${now}_${Math.random().toString(36).slice(2, 8)}`,
    videos: videoNames.map((name, index) => ({
      id: `video_${index}_${now}`,
      name,
      status: 'pending',
      progress: 0,
    })),
    createdAt: now,
    updatedAt: now,
    config,
  }
  saveBatchState(batch)
  return batch
}

export function updateVideoInBatch(batchId: string, videoId: string, updates: Partial<BatchVideo>): BatchState | null {
  const state = loadBatchState()
  if (!state || state.id !== batchId) return null

  const index = state.videos.findIndex((video) => video.id === videoId)
  if (index === -1) return null

  state.videos[index] = { ...state.videos[index], ...updates }
  saveBatchState(state)
  return state
}

export function getCompletedVideos(state: BatchState): BatchVideo[] {
  return state.videos.filter((video) => video.status === 'completed' && !!video.blobUrl)
}

export function canRecoverBatch(): boolean {
  const state = loadBatchState()
  if (!state) return false
  return state.videos.some((video) => video.status === 'completed' && !!video.blobUrl)
}

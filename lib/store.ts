import { create } from 'zustand'

export interface VideoFile {
  id: string
  file: File
  name: string
  url: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  processedUrl: string | null
  processedBlob: Blob | null
  error?: string
}

export interface OverlayConfig {
  style: 'banner' | 'fulltext'
  line1_text: string
  line1_bg_color: string
  line1_text_color: string
  line2_text: string
  line2_bg_color: string
  line2_text_color: string
  text: string
  duration?: number
}

interface VideoStore {
  videos: VideoFile[]
  overlayConfig: OverlayConfig
  isProcessing: boolean
  addVideos: (files: FileList | File[]) => void
  removeVideo: (id: string) => void
  clearVideos: () => void
  setOverlayConfig: (config: Partial<OverlayConfig>) => void
  setVideoStatus: (id: string, status: VideoFile['status'], progress?: number) => void
  setVideoProcessed: (id: string, url: string, blob: Blob) => void
  setVideoError: (id: string, error: string) => void
  setIsProcessing: (value: boolean) => void
  resetProcessing: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

export const useVideoStore = create<VideoStore>((set) => ({
  videos: [],
  overlayConfig: {
    style: 'banner',
    line1_text: 'TRIPLE DISCOUNT',
    line1_bg_color: '#FF0000',
    line1_text_color: '#FFFFFF',
    line2_text: '4 HOURS LEFT',
    line2_bg_color: '#FFFFFF',
    line2_text_color: '#000000',
    text: '',
  },
  isProcessing: false,

  addVideos: (files) => {
    const fileArray = Array.from(files)
    const videoFiles: VideoFile[] = []

    for (const file of fileArray) {
      const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm|avi|mkv|m4v|3gp)$/i)
      if (!isVideo) continue

      videoFiles.push({
        id: generateId(),
        file,
        name: file.name,
        url: URL.createObjectURL(file),
        status: 'pending',
        progress: 0,
        processedUrl: null,
        processedBlob: null,
      })
    }

    set((state) => ({ videos: [...state.videos, ...videoFiles] }))
  },

  removeVideo: (id) => {
    set((state) => {
      const video = state.videos.find((v) => v.id === id)
      if (video) {
        URL.revokeObjectURL(video.url)
        if (video.processedUrl) URL.revokeObjectURL(video.processedUrl)
      }
      return { videos: state.videos.filter((v) => v.id !== id) }
    })
  },

  clearVideos: () => {
    set((state) => {
      state.videos.forEach((v) => {
        URL.revokeObjectURL(v.url)
        if (v.processedUrl) URL.revokeObjectURL(v.processedUrl)
      })
      return { videos: [] }
    })
  },

  setOverlayConfig: (config) => {
    set((state) => ({ overlayConfig: { ...state.overlayConfig, ...config } }))
  },

  setVideoStatus: (id, status, progress = 0) => {
    set((state) => ({
      videos: state.videos.map((v) => (v.id === id ? { ...v, status, progress } : v)),
    }))
  },

  setVideoProcessed: (id, url, blob) => {
    set((state) => ({
      videos: state.videos.map((v) =>
        v.id === id ? { ...v, status: 'completed', progress: 100, processedUrl: url, processedBlob: blob } : v
      ),
    }))
  },

  setVideoError: (id, error) => {
    set((state) => ({
      videos: state.videos.map((v) => (v.id === id ? { ...v, status: 'error', error } : v)),
    }))
  },

  setIsProcessing: (value) => set({ isProcessing: value }),

  resetProcessing: () => {
    set((state) => ({
      videos: state.videos.map((v) => ({
        ...v,
        status: 'pending',
        progress: 0,
        processedUrl: null,
        processedBlob: null,
        error: undefined,
      })),
    }))
  },
}))

import type { MusicStyle, MusicTrack } from './store'

const VOICE_BASE = 'https://nee0ohydcl6bxykj.public.blob.vercel-storage.com/voices'

const STYLE_MAP: Record<number, MusicStyle[]> = {
  1: ['urgent-promo', 'hype-offer'],
  2: ['countdown-sale', 'energetic-cta'],
  3: ['double-discount', 'fast-ecommerce'],
  4: ['urgent-promo', 'countdown-sale'],
  5: ['hype-offer', 'fast-ecommerce'],
}

export const MUSIC_LIBRARY: MusicTrack[] = Array.from({ length: 20 }, (_, idx) => {
  const n = idx + 1
  const styleSeed = ((n - 1) % 5) + 1
  return {
    id: `voice-${String(n).padStart(2, '0')}`,
    name: `Voice ${String(n).padStart(2, '0')}`,
    url: `${VOICE_BASE}/voice-${String(n).padStart(2, '0')}.mp3`,
    duration: 10,
    style: STYLE_MAP[styleSeed],
  }
})

export const STYLE_LABELS: Record<MusicStyle, string> = {
  'double-discount': 'Double Discount',
  'urgent-promo': 'Urgent Promo',
  'countdown-sale': 'Countdown Sale',
  'hype-offer': 'Hype Offer',
  'fast-ecommerce': 'Fast Ecommerce',
  'energetic-cta': 'Energetic CTA',
}

export function assignTracksToVideos(videoIds: string[], preferredStyle: MusicStyle | 'random' | null): Record<string, MusicTrack> {
  const pool = preferredStyle && preferredStyle !== 'random'
    ? MUSIC_LIBRARY.filter((track) => track.style.includes(preferredStyle))
    : MUSIC_LIBRARY

  const source = pool.length > 0 ? pool : MUSIC_LIBRARY
  const assignments: Record<string, MusicTrack> = {}

  videoIds.forEach((id, index) => {
    assignments[id] = source[index % source.length]
  })

  return assignments
}

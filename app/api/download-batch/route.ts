import JSZip from 'jszip'
import { type NextRequest, NextResponse } from 'next/server'

interface DownloadRequest {
  videos: Array<{ name: string; url: string }>
}

export async function POST(request: NextRequest) {
  try {
    const { videos } = (await request.json()) as DownloadRequest

    if (!videos || videos.length === 0) {
      return NextResponse.json({ error: 'No videos provided' }, { status: 400 })
    }

    const zip = new JSZip()

    for (const video of videos) {
      try {
        const response = await fetch(video.url)
        if (!response.ok) continue

        const fileBuffer = await response.arrayBuffer()
        const extension = video.url.includes('.mp4') ? '.mp4' : '.webm'
        const safeName = video.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_')
        zip.file(`edited_${safeName}${extension}`, fileBuffer)
      } catch (error) {
        console.warn('Skipping video in ZIP:', video.name, error)
      }
    }

    if (Object.keys(zip.files).length === 0) {
      return NextResponse.json({ error: 'No downloadable files found' }, { status: 400 })
    }

    const zipBuffer = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 },
    })

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="vidbot_batch_${Date.now()}.zip"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('ZIP creation error:', error)
    return NextResponse.json({ error: 'ZIP creation failed' }, { status: 500 })
  }
}

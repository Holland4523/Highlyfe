import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const rawName = request.headers.get('X-Filename') || `video_${Date.now()}.webm`
    const filename = decodeURIComponent(rawName).replace(/[^a-zA-Z0-9._-]/g, '_')
    const videoBlob = await request.blob()

    const uploaded = await put(`processed/${Date.now()}_${filename}`, videoBlob, {
      access: 'public',
      contentType: videoBlob.type || 'video/webm',
      addRandomSuffix: true,
    })

    return NextResponse.json({ url: uploaded.url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from 'next/server'

const BLOB_BASE_URL = 'https://blob.vercel-storage.com'

export async function POST(request: NextRequest) {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'Missing BLOB_READ_WRITE_TOKEN' }, { status: 500 })
    }

    const filename = decodeURIComponent(request.headers.get('X-Filename') || `video_${Date.now()}.webm`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `processed/${Date.now()}_${filename}`

    const blob = await request.blob()

    const upload = await fetch(`${BLOB_BASE_URL}/${key}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': blob.type || 'application/octet-stream',
        'x-add-random-suffix': '1',
        'x-cache-control-max-age': '31536000',
      },
      body: blob,
    })

    if (!upload.ok) {
      const detail = await upload.text()
      return NextResponse.json({ error: 'Upload failed', detail }, { status: 500 })
    }

    const data = (await upload.json()) as { url?: string }
    if (!data.url) {
      return NextResponse.json({ error: 'Blob API did not return URL' }, { status: 500 })
    }

    return NextResponse.json({ url: data.url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

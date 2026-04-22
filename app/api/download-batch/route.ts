import { type NextRequest, NextResponse } from 'next/server'

type ZipInputFile = { name: string; data: Uint8Array }

function crc32(data: Uint8Array): number {
  let crc = 0 ^ -1
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

const CRC_TABLE = new Uint32Array(256).map((_, i) => {
  let c = i
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  }
  return c >>> 0
})

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true)
}

function makeZip(files: ZipInputFile[]): Uint8Array {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const data = file.data
    const crc = crc32(data)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    writeUint32(localView, 0, 0x04034b50)
    writeUint16(localView, 4, 20)
    writeUint16(localView, 6, 0)
    writeUint16(localView, 8, 0)
    writeUint16(localView, 10, 0)
    writeUint16(localView, 12, 0)
    writeUint32(localView, 14, crc)
    writeUint32(localView, 18, data.length)
    writeUint32(localView, 22, data.length)
    writeUint16(localView, 26, nameBytes.length)
    writeUint16(localView, 28, 0)
    localHeader.set(nameBytes, 30)

    localParts.push(localHeader, data)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    writeUint32(centralView, 0, 0x02014b50)
    writeUint16(centralView, 4, 20)
    writeUint16(centralView, 6, 20)
    writeUint16(centralView, 8, 0)
    writeUint16(centralView, 10, 0)
    writeUint16(centralView, 12, 0)
    writeUint16(centralView, 14, 0)
    writeUint32(centralView, 16, crc)
    writeUint32(centralView, 20, data.length)
    writeUint32(centralView, 24, data.length)
    writeUint16(centralView, 28, nameBytes.length)
    writeUint16(centralView, 30, 0)
    writeUint16(centralView, 32, 0)
    writeUint16(centralView, 34, 0)
    writeUint16(centralView, 36, 0)
    writeUint32(centralView, 38, 0)
    writeUint32(centralView, 42, offset)
    centralHeader.set(nameBytes, 46)

    centralParts.push(centralHeader)
    offset += localHeader.length + data.length
  }

  const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0)
  const centralOffset = offset

  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  writeUint32(endView, 0, 0x06054b50)
  writeUint16(endView, 4, 0)
  writeUint16(endView, 6, 0)
  writeUint16(endView, 8, files.length)
  writeUint16(endView, 10, files.length)
  writeUint32(endView, 12, centralSize)
  writeUint32(endView, 16, centralOffset)
  writeUint16(endView, 20, 0)

  const totalLength = localParts.concat(centralParts, [end]).reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(totalLength)
  let ptr = 0

  for (const part of [...localParts, ...centralParts, end]) {
    out.set(part, ptr)
    ptr += part.length
  }

  return out
}

export async function POST(request: NextRequest) {
  try {
    const { videos } = (await request.json()) as {
      videos: Array<{ name: string; url: string }>
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({ error: 'No videos provided' }, { status: 400 })
    }

    const files: ZipInputFile[] = []

    for (const video of videos) {
      try {
        const response = await fetch(video.url)
        if (!response.ok) continue

        const bytes = new Uint8Array(await response.arrayBuffer())
        const ext = video.url.includes('.mp4') ? '.mp4' : '.webm'
        const filename = `edited_${video.name.replace(/\.[^.]+$/, '')}${ext}`
        files.push({ name: filename, data: bytes })
      } catch {
        continue
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No downloadable files found' }, { status: 400 })
    }

    const zip = makeZip(files)

    const zipBytes = new Uint8Array(zip.length)
    zipBytes.set(zip)

    return new NextResponse(zipBytes as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="vidbot_batch_${Date.now()}.zip"`,
      },
    })
  } catch (error) {
    console.error('ZIP creation error:', error)
    return NextResponse.json({ error: 'ZIP creation failed' }, { status: 500 })
  }
}

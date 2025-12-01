import { parseBlob } from 'music-metadata'

// Media duration helpers that avoid relying solely on HTMLMediaElement metadata.
// Strategies:
// 1) Try the browser media element (fast path).
// 2) Try music-metadata (container-aware, audio+video).
// 3) Parse MP4/MOV boxes (supports moov at head or tail).
// 4) Parse minimal WebM duration.
// 5) Approximate MP3 duration from first frame bitrate.

const MP4_READ_BYTES = 8 * 1024 * 1024 // read generous head/tail in case moov is large
const WEBM_READ_BYTES = 2 * 1024 * 1024 // capture Info even if not at the very start
const MP3_READ_BYTES = 512 * 1024 // enough to find first frame after ID3
const METADATA_PARSE_MAX_BYTES = 2 * 1024 * 1024 * 1024

async function readSlice(file: File, start: number, length: number): Promise<ArrayBuffer> {
  const end = Math.min(file.size, start + length)
  return file.slice(start, end).arrayBuffer()
}

// --- Media element probe ----------------------------------------------------
async function probeWithMediaElement(file: File): Promise<number | null> {
  const isAudio = file.type.startsWith('audio/')
  const el = document.createElement(isAudio ? 'audio' : 'video')
  el.preload = 'metadata'
  el.muted = true
  el.playsInline = true
  el.style.display = 'none'

  return await new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file)
    let timeout: number | undefined

    const cleanup = () => {
      if (timeout) window.clearTimeout(timeout)
      URL.revokeObjectURL(url)
      el.removeEventListener('loadedmetadata', onLoadedMeta)
      el.removeEventListener('durationchange', onDurationChange)
      el.removeEventListener('error', onError)
      el.src = ''
      if (el.parentNode) {
        el.parentNode.removeChild(el)
      }
    }

    const finish = (dur: number | null) => {
      cleanup()
      resolve(dur)
    }

    const finiteDur = () => (Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null)

    const onLoadedMeta = () => {
      const d = finiteDur()
      if (d !== null) {
        finish(d)
        return
      }
      if (el.duration === Infinity || el.duration === Number.POSITIVE_INFINITY) {
        el.currentTime = Number.MAX_SAFE_INTEGER
      } else {
        el.currentTime = 1
      }
    }

    const onDurationChange = () => {
      const d = finiteDur()
      if (d !== null) finish(d)
    }

    const onError = () => finish(null)

    timeout = window.setTimeout(() => finish(finiteDur()), 6000)

    el.addEventListener('loadedmetadata', onLoadedMeta)
    el.addEventListener('durationchange', onDurationChange)
    el.addEventListener('error', onError)

    document.body.appendChild(el)
    el.src = url
    el.load()
  }).catch(() => null)
}

// --- MP4/MOV parsing --------------------------------------------------------
function parseMp4DurationFromBuffer(buffer: ArrayBuffer, baseOffset = 0): number | null {
  const view = new DataView(buffer)

  const readType = (offset: number) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    )

  const parseMvhd = (offset: number, size: number): number | null => {
    if (size < 20 || offset + size > view.byteLength) return null
    const version = view.getUint8(offset + 8)
    if (version === 1) {
      if (offset + 32 >= view.byteLength) return null
      const timescale = view.getUint32(offset + 20, false)
      const upper = view.getUint32(offset + 24, false)
      const lower = view.getUint32(offset + 28, false)
      const duration = upper * 2 ** 32 + lower
      if (timescale > 0 && duration > 0) return duration / timescale
    } else {
      if (offset + 16 >= view.byteLength) return null
      const timescale = view.getUint32(offset + 12, false)
      const duration = view.getUint32(offset + 16, false)
      if (timescale > 0 && duration > 0) return duration / timescale
    }
    return null
  }

  let offset = 0
  while (offset + 8 <= view.byteLength) {
    let size = view.getUint32(offset, false)
    const type = readType(offset + 4)
    if (size === 1) {
      // large size
      if (offset + 16 > view.byteLength) break
      const upper = view.getUint32(offset + 8, false)
      const lower = view.getUint32(offset + 12, false)
      size = upper * 2 ** 32 + lower
    }
    if (!size || size < 8) break
    if (type === 'moov') {
      let inner = offset + 8
      const end = offset + size
      while (inner + 8 <= end && inner + 8 <= view.byteLength) {
        let boxSize = view.getUint32(inner, false)
        const boxType = readType(inner + 4)
        if (boxSize === 1) {
          if (inner + 16 > view.byteLength) break
          const upper = view.getUint32(inner + 8, false)
          const lower = view.getUint32(inner + 12, false)
          boxSize = upper * 2 ** 32 + lower
        }
        if (!boxSize || boxSize < 8) break
        if (boxType === 'mvhd') {
          const dur = parseMvhd(inner, boxSize)
          if (dur) return dur
        }
        inner += boxSize
      }
    }
    offset += size
  }
  return null
}

async function probeMp4Duration(file: File): Promise<number | null> {
  // Read head
  const head = await readSlice(file, 0, MP4_READ_BYTES)
  const headDur = parseMp4DurationFromBuffer(head, 0)
  if (headDur) return headDur
  // Read tail (in case moov is at end)
  if (file.size > MP4_READ_BYTES) {
    const tailStart = Math.max(0, file.size - MP4_READ_BYTES)
    const tail = await readSlice(file, tailStart, MP4_READ_BYTES)
    const tailDur = parseMp4DurationFromBuffer(tail, tailStart)
    if (tailDur) return tailDur
  }
  return null
}

// --- WebM parsing -----------------------------------------------------------
function readVint(view: DataView, offset: number) {
  if (offset >= view.byteLength) return { length: 0, value: 0 }
  const first = view.getUint8(offset)
  let mask = 0x80
  let length = 1
  while (length <= 8 && (first & mask) === 0) {
    length += 1
    mask >>= 1
  }
  if (length > 8 || offset + length > view.byteLength) return { length: 0, value: 0 }
  let value = first & (mask - 1)
  for (let i = 1; i < length; i += 1) {
    value = (value << 8) + view.getUint8(offset + i)
  }
  return { length, value }
}

function parseWebmDuration(buffer: ArrayBuffer): number | null {
  const view = new DataView(buffer)
  let offset = 0

  const EBML_ID = 0x1a45dfa3
  const SEGMENT_ID = 0x18538067
  const INFO_ID = 0x1549a966
  const DURATION_ID = 0x4489
  const TIMECODE_SCALE_ID = 0x2ad7b1

  const readId = () => readVint(view, offset)
  const readSize = (o: number) => readVint(view, o)

  const readFloat = (pos: number, len: number): number | null => {
    if (len === 4) return view.getFloat32(pos, false)
    if (len === 8) return view.getFloat64(pos, false)
    return null
  }

  const consumeElement = (id: number, size: number, onInfo: (start: number, size: number) => void) => {
    if (offset + size > view.byteLength) return false
    onInfo(offset, size)
    offset += size
    return true
  }

  // Expect EBML header then Segment
  const id = readId()
  if (id.value !== EBML_ID || id.length === 0) return null
  const size = readSize(offset + id.length)
  offset += id.length + size.length + size.value

  if (offset >= view.byteLength) return null
  const segId = readId()
  if (segId.value !== SEGMENT_ID || segId.length === 0) return null
  const segSize = readSize(offset + segId.length)
  if (segSize.length === 0) return null
  offset += segId.length + segSize.length
  const segEnd = segSize.value === (1 << (7 * segSize.length)) - 1 ? view.byteLength : offset + segSize.value

  let duration: number | null = null
  let timecodeScale = 1000000 // default per spec

  while (offset < segEnd && offset < view.byteLength) {
    const elemId = readId()
    if (elemId.length === 0) break
    const elemSize = readSize(offset + elemId.length)
    if (elemSize.length === 0) break
    const elemStart = offset + elemId.length + elemSize.length
    const elemEnd = elemStart + elemSize.value
    if (elemId.value === INFO_ID) {
      let infoOffset = elemStart
      while (infoOffset < elemEnd) {
        const childId = readVint(view, infoOffset)
        const childSize = readVint(view, infoOffset + childId.length)
        if (childId.length === 0 || childSize.length === 0) break
        const childStart = infoOffset + childId.length + childSize.length
        if (childId.value === DURATION_ID) {
          duration = readFloat(childStart, childSize.value)
        } else if (childId.value === TIMECODE_SCALE_ID) {
          timecodeScale = view.getUint32(childStart, false)
        }
        infoOffset = childStart + childSize.value
      }
      break
    }
    offset = elemEnd
  }

  if (duration && Number.isFinite(duration) && timecodeScale > 0) {
    return (duration * timecodeScale) / 1_000_000_000
  }
  return null
}

async function probeWebmDuration(file: File): Promise<number | null> {
  const head = await readSlice(file, 0, WEBM_READ_BYTES)
  return parseWebmDuration(head)
}

// --- MP3 approximate parsing -----------------------------------------------
const MP3_BITRATES: Record<number, Record<number, number[]>> = {
  // version: { layer: [bitrate slots] }
  3: {
    // MPEG1
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // Layer I
    2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384], // Layer II
    1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // Layer III
  },
  2: {
    // MPEG2
    3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224], // Layer I
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // Layer II
    1: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // Layer III
  },
}
const MP3_SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG1
  2: [22050, 24000, 16000], // MPEG2
  0: [11025, 12000, 8000], // MPEG2.5
}

function estimateMp3Duration(buffer: ArrayBuffer, fileSize: number): number | null {
  const view = new DataView(buffer)
  let offset = 0

  // Skip ID3v2 if present
  if (
    view.getUint8(0) === 0x49 &&
    view.getUint8(1) === 0x44 &&
    view.getUint8(2) === 0x33 &&
    view.byteLength >= 10
  ) {
    const size =
      ((view.getUint8(6) & 0x7f) << 21) |
      ((view.getUint8(7) & 0x7f) << 14) |
      ((view.getUint8(8) & 0x7f) << 7) |
      (view.getUint8(9) & 0x7f)
    offset = 10 + size
  }

  for (; offset + 4 < view.byteLength; offset += 1) {
    const header = view.getUint32(offset, false)
    if ((header & 0xffe00000) !== 0xffe00000) continue // frame sync
    const versionBits = (header >> 19) & 0x3
    const layerBits = (header >> 17) & 0x3
    const bitrateIdx = (header >> 12) & 0xf
    const sampleIdx = (header >> 10) & 0x3
    if (versionBits === 1 || layerBits === 0 || bitrateIdx === 0xf || sampleIdx === 3) continue

    const version = versionBits === 3 ? 3 : versionBits === 2 ? 2 : 0
    const layer = 4 - layerBits // map bits to 1/2/3
    const bitrates = MP3_BITRATES[version]?.[layer]
    const sampleRates = MP3_SAMPLE_RATES[version]
    if (!bitrates || !sampleRates) continue
    const bitrate = bitrates[bitrateIdx] * 1000
    const sampleRate = sampleRates[sampleIdx]
    if (!bitrate || !sampleRate) continue

    // For Layer III frame length formula differs, but for duration we only need bitrate.
    const durationSeconds = fileSize * 8 / bitrate
    return durationSeconds > 0 && Number.isFinite(durationSeconds) ? durationSeconds : null
  }

  return null
}

async function probeMp3Duration(file: File): Promise<number | null> {
  const head = await readSlice(file, 0, MP3_READ_BYTES)
  return estimateMp3Duration(head, file.size)
}

// --- Public API -------------------------------------------------------------
export async function getMediaDuration(file: File): Promise<number | null> {
  // Fast path
  const mediaElementDuration = await probeWithMediaElement(file)
  if (mediaElementDuration && Number.isFinite(mediaElementDuration) && mediaElementDuration > 0) {
    return mediaElementDuration
  }

  // Container-aware parser (audio + video). Avoid excessively large files to keep it snappy.
  if (file.size <= METADATA_PARSE_MAX_BYTES) {
    try {
      const meta = await parseBlob(file)
      const dur = meta.format?.duration
      if (dur && Number.isFinite(dur) && dur > 0) {
        return dur
      }
    } catch {
      // fall through
    }
  }

  const lowerName = file.name.toLowerCase()

  if (file.type.includes('mp4') || lowerName.endsWith('.mp4') || lowerName.endsWith('.mov')) {
    const mp4Dur = await probeMp4Duration(file)
    if (mp4Dur && Number.isFinite(mp4Dur) && mp4Dur > 0) return mp4Dur
  }

  if (file.type.includes('webm') || lowerName.endsWith('.webm')) {
    const webmDur = await probeWebmDuration(file)
    if (webmDur && Number.isFinite(webmDur) && webmDur > 0) return webmDur
  }

  if (file.type.includes('mp3') || lowerName.endsWith('.mp3')) {
    const mp3Dur = await probeMp3Duration(file)
    if (mp3Dur && Number.isFinite(mp3Dur) && mp3Dur > 0) return mp3Dur
  }

  // Audio decode fallback (best-effort, avoids video). Guard size to avoid huge reads.
  if (file.type.startsWith('audio/') && file.size < 200 * 1024 * 1024) {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const arr = await file.arrayBuffer()
      const decoded = await audioCtx.decodeAudioData(arr)
      if (decoded?.duration && Number.isFinite(decoded.duration) && decoded.duration > 0) {
        return decoded.duration
      }
    } catch {
      // ignore decode failures
    }
  }

  return null
}

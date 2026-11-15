/**
 * بوم چین — Success audio (Web Audio API, fully synthesized, zero files).
 *
 * A short rising chime plays whenever two balls merge ("توپ به هم خورد")
 * so every merge is clearly signaled as a success. A small fanfare plays
 * when two max-tier gems produce a star blast.
 *
 * The AudioContext is created/resumed lazily from a user gesture
 * (engine pointerdown) to satisfy mobile autoplay policies. A light
 * background music loop (see startMusic) shares the same context.
 */

let ctx: AudioContext | null = null
let enabled = true

// ------------------------------------------------------- background music
// Light instrumental loop (public/music/boomchin-theme.mp3), played on a
// looping AudioBufferSource so it repeats seamlessly. Starts on the first
// user gesture (same unlockAudio as the SFX) and can be toggled in settings.

let musicEnabled = true
let musicStarting = false
let musicSource: AudioBufferSourceNode | null = null
let musicGain: GainNode | null = null
let visibilityHooked = false

/** Music volume (the rendered file itself is already very quiet). */
const MUSIC_VOLUME = 0.55
const MUSIC_URL = '/music/boomchin-theme.mp3'

function hookVisibility() {
  if (visibilityHooked || typeof document === 'undefined') return
  visibilityHooked = true
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) {
      void ctx.suspend().catch(() => undefined)
    } else {
      void ctx.resume().catch(() => undefined)
    }
  })
}

async function startMusic() {
  if (!ctx || ctx.state !== 'running' || !musicEnabled || musicStarting || musicSource) return
  musicStarting = true
  try {
    const res = await fetch(MUSIC_URL)
    if (!res.ok) throw new Error(String(res.status))
    const raw = await res.arrayBuffer()
    const buffer = await ctx.decodeAudioData(raw)
    if (!ctx || !musicEnabled) return
    musicGain = ctx.createGain()
    musicGain.gain.value = MUSIC_VOLUME
    musicGain.connect(ctx.destination)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.connect(musicGain)
    src.start()
    musicSource = src
    hookVisibility()
  } catch {
    /* music is optional — never break the game over it */
  } finally {
    musicStarting = false
  }
}

function stopMusic() {
  try {
    musicSource?.stop()
  } catch {
    /* already stopped */
  }
  musicSource = null
  try {
    musicGain?.disconnect()
  } catch {
    /* ignore */
  }
  musicGain = null
}

/** Toggle the background music from game settings. */
export function setMusicEnabled(v: boolean) {
  musicEnabled = v
  if (v) void startMusic()
  else stopMusic()
}

type WindowWithWebkit = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

/** Toggle the success chime from game settings. */
export function setSoundEnabled(v: boolean) {
  enabled = v
}

/** Create / resume the AudioContext. Must be called inside a user-gesture handler. */
export function unlockAudio() {
  if (typeof window === 'undefined') return
  try {
    if (!ctx) {
      const W = window as WindowWithWebkit
      const AC = window.AudioContext ?? W.webkitAudioContext
      if (!AC) return
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
    // background music rides on the same unlocked context
    if (musicEnabled) void startMusic()
  } catch {
    /* audio not available on this device */
  }
}

interface ToneOpts {
  freq: number
  /** Start offset in seconds from now. */
  at: number
  dur: number
  type?: OscillatorType
  gain?: number
  glideTo?: number
}

function tone({ freq, at, dur, type = 'triangle', gain = 0.16, glideTo }: ToneOpts) {
  if (!ctx || ctx.state !== 'running') return
  const t0 = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

/**
 * Success chime for a merge. `tier` is the resulting tier (1..5) —
 * bigger merges ring brighter and higher.
 */
export function sfxMerge(tier: number) {
  if (!enabled) return
  unlockAudio()
  if (!ctx || ctx.state !== 'running') return
  // base pitch rises 2 semitones per tier: D5, E5, F#5, G#5, A#5
  const base = 587.33 * Math.pow(2, ((tier - 1) * 2) / 12)
  tone({ freq: base, at: 0, dur: 0.14 })
  tone({ freq: base * 1.25, at: 0.055, dur: 0.17 }) // major third on top
  if (tier >= 4) tone({ freq: base * 1.5, at: 0.11, dur: 0.2, gain: 0.12 }) // fifth sparkle
}

/** Triumphant arpeggio for the max-tier star blast. */
export function sfxStarBlast() {
  if (!enabled) return
  unlockAudio()
  if (!ctx || ctx.state !== 'running') return
  const notes = [587.33, 739.99, 880, 1174.66] // D5 F#5 A5 D6
  notes.forEach((f, i) => tone({ freq: f, at: i * 0.07, dur: 0.22, gain: 0.15 }))
  tone({ freq: 293.66, at: 0, dur: 0.5, type: 'sine', gain: 0.1, glideTo: 220 }) // deep boom body
}

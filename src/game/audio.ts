/**
 * بوم چین — Success audio (Web Audio API, fully synthesized, zero files).
 *
 * A short rising chime plays whenever two balls merge ("توپ به هم خورد")
 * so every merge is clearly signaled as a success. A small fanfare plays
 * when two max-tier gems produce a star blast.
 *
 * The AudioContext is created/resumed lazily from a user gesture
 * (engine pointerdown) to satisfy mobile autoplay policies.
 */

let ctx: AudioContext | null = null
let enabled = true

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

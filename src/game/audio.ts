/**
 * بوم چین — Sound effects (Web Audio API, fully synthesized, zero files).
 *
 *  - sfxShoot    : launch "thump + whoosh" when the turret fires a missile
 *  - sfxImpact   : crash/boom when the missile lands (normal or bomb)
 *  - sfxMerge    : rising chime when two balls merge
 *  - sfxStarBlast: triumphant arpeggio for the max-tier star blast
 *
 * The AudioContext is created/resumed lazily from a user gesture
 * (engine pointerdown) to satisfy mobile autoplay policies.
 */

let ctx: AudioContext | null = null
let enabled = true

type WindowWithWebkit = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

/** Toggle the sound effects from game settings. */
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

// ------------------------------------------------------------ noise helpers

let noiseBuf: AudioBuffer | null = null

/** Shared 0.35s white-noise buffer (created lazily, reused everywhere). */
function noise(): AudioBuffer | null {
  if (!ctx) return null
  if (!noiseBuf) {
    const len = Math.floor(ctx.sampleRate * 0.35)
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

interface NoiseOpts {
  at: number
  dur: number
  type?: BiquadFilterType
  /** Filter start frequency (Hz). */
  freq: number
  /** Optional filter sweep target (Hz). */
  sweepTo?: number
  q?: number
  gain?: number
}

/** Filtered noise burst — the raw material for whooshes, crashes and debris. */
function noiseBurst({ at, dur, type = 'lowpass', freq, sweepTo, q, gain = 0.2 }: NoiseOpts) {
  if (!ctx || ctx.state !== 'running') return
  const buf = noise()
  if (!buf) return
  const t0 = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = buf
  // random read offset so consecutive bursts never sound identical
  const offset = Math.random() * Math.max(0, buf.duration - dur - 0.02)
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t0)
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur)
  if (q) f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f)
  f.connect(g)
  g.connect(ctx.destination)
  src.start(t0, offset)
  src.stop(t0 + dur + 0.05)
}

// ---------------------------------------------------------- game sound fx

/** Launch sound: a soft cannon "puff" thump + airy whoosh sweeping upward. */
export function sfxShoot() {
  if (!enabled) return
  unlockAudio()
  if (!ctx || ctx.state !== 'running') return
  tone({ freq: 250, at: 0, dur: 0.15, type: 'sine', gain: 0.2, glideTo: 80 })
  noiseBurst({ at: 0.01, dur: 0.2, type: 'bandpass', freq: 750, sweepTo: 2800, q: 1.2, gain: 0.14 })
}

/**
 * Missile impact sound. `bomb` gives a much deeper, wider explosion.
 */
export function sfxImpact(bomb = false) {
  if (!enabled) return
  unlockAudio()
  if (!ctx || ctx.state !== 'running') return
  if (bomb) {
    // big boom: sub-bass drop + wide crashing noise + bright crack
    tone({ freq: 160, at: 0, dur: 0.5, type: 'sine', gain: 0.42, glideTo: 44 })
    noiseBurst({ at: 0, dur: 0.42, type: 'lowpass', freq: 2400, sweepTo: 220, gain: 0.32 })
    noiseBurst({ at: 0.01, dur: 0.16, type: 'highpass', freq: 1500, gain: 0.09 })
    return
  }
  // crisp hit: short body drop + muffled crash + tiny debris sparkle
  tone({ freq: 200, at: 0, dur: 0.18, type: 'sine', gain: 0.28, glideTo: 62 })
  noiseBurst({ at: 0, dur: 0.15, type: 'lowpass', freq: 1900, sweepTo: 380, gain: 0.2 })
  noiseBurst({ at: 0.02, dur: 0.08, type: 'highpass', freq: 2600, gain: 0.07 })
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

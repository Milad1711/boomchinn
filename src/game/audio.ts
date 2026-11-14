/**
 * STACK & SMASH - Procedural audio (WebAudio).
 * All SFX + ambient music are synthesized at runtime; no audio assets needed.
 * Singleton `audio` is shared between UI (clicks) and the 3D engine.
 */

const MUSIC_CHORDS: number[][] = [
  [130.81, 164.81, 196.0, 246.94], // Cmaj7
  [110.0, 130.81, 164.81, 196.0], // Am7
  [87.31, 110.0, 130.81, 174.61], // Fmaj
  [98.0, 123.47, 146.83, 196.0], // G
]

class AudioManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private musicTimer: ReturnType<typeof setInterval> | null = null
  private chordIdx = 0
  private sfxOn = true
  private musicOn = true

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 1
      this.master.connect(this.ctx.destination)
      this.sfxBus = this.ctx.createGain()
      this.sfxBus.gain.value = 0.9
      this.sfxBus.connect(this.master)
      this.musicBus = this.ctx.createGain()
      this.musicBus.gain.value = 0.55
      this.musicBus.connect(this.master)
      // cached noise buffer
      const len = this.ctx.sampleRate * 0.5
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    if (this.musicOn) this.startMusic()
  }

  applySettings(sfx: boolean, music: boolean) {
    this.sfxOn = sfx
    this.musicOn = music
    if (music) this.startMusic()
    else this.stopMusic()
  }

  // ---------------------------------------------------------------- helpers

  private tone(
    type: OscillatorType,
    freq: number,
    dur: number,
    gain: number,
    opts?: { endFreq?: number; delay?: number; bus?: GainNode }
  ) {
    if (!this.ctx || !this.sfxBus) return
    const t0 = this.ctx.currentTime + (opts?.delay ?? 0)
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (opts?.endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(opts?.bus ?? this.sfxBus)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  private noise(dur: number, gain: number, filterFreq: number, type: BiquadFilterType = 'lowpass', delay = 0) {
    if (!this.ctx || !this.sfxBus || !this.noiseBuf) return
    const t0 = this.ctx.currentTime + delay
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = filterFreq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.sfxBus)
    src.start(t0)
    src.stop(t0 + dur + 0.05)
  }

  private get sfxReady(): boolean {
    return this.ctx !== null && this.sfxOn
  }

  // ------------------------------------------------------------------- sfx

  click() {
    if (!this.sfxReady) return
    this.tone('square', 660, 0.06, 0.1, { endFreq: 880 })
  }

  pick() {
    if (!this.sfxReady) return
    this.tone('sine', 500, 0.08, 0.12, { endFreq: 700 })
  }

  merge(tier: number) {
    if (!this.sfxReady) return
    const base = 300 + tier * 120
    this.tone('sine', base, 0.22, 0.28, { endFreq: base * 1.9 })
    this.tone('sine', base * 1.5, 0.18, 0.14, { delay: 0.05 })
    if (tier >= 2) this.tone('triangle', base * 2, 0.25, 0.12, { delay: 0.09 })
    this.noise(0.1, 0.06, 3200, 'highpass')
  }

  break_() {
    if (!this.sfxReady) return
    this.noise(0.3, 0.4, 750)
    this.tone('sine', 90, 0.25, 0.35, { endFreq: 45 })
  }

  crack() {
    if (!this.sfxReady) return
    this.noise(0.09, 0.2, 1800)
  }

  shoot() {
    if (!this.sfxReady) return
    this.noise(0.14, 0.25, 900, 'bandpass')
    this.tone('square', 150, 0.14, 0.22, { endFreq: 60 })
  }

  thud() {
    if (!this.sfxReady) return
    this.tone('sine', 110, 0.12, 0.16, { endFreq: 55 })
  }

  coin() {
    if (!this.sfxReady) return
    this.tone('square', 1318, 0.07, 0.1)
    this.tone('square', 1760, 0.12, 0.1, { delay: 0.07 })
  }

  win() {
    if (!this.sfxReady) return
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((n, i) => this.tone('triangle', n, 0.34, 0.22, { delay: i * 0.13 }))
  }

  lose() {
    if (!this.sfxReady) return
    this.tone('sawtooth', 260, 0.55, 0.16, { endFreq: 120 })
    this.tone('sine', 180, 0.5, 0.12, { delay: 0.1, endFreq: 90 })
  }

  blast() {
    if (!this.sfxReady) return
    this.noise(0.5, 0.5, 500)
    this.tone('sine', 70, 0.5, 0.4, { endFreq: 32 })
    this.tone('triangle', 1046, 0.3, 0.15, { delay: 0.05 })
  }

  // ----------------------------------------------------------------- music

  startMusic() {
    if (!this.ctx || !this.musicBus || this.musicTimer || !this.musicOn) return
    const playChord = () => {
      if (!this.ctx || !this.musicBus) return
      const chord = MUSIC_CHORDS[this.chordIdx % MUSIC_CHORDS.length]
      this.chordIdx++
      const t0 = this.ctx.currentTime
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 720
      filter.connect(this.musicBus)
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.linearRampToValueAtTime(0.05, t0 + 0.9)
      g.gain.linearRampToValueAtTime(0.0001, t0 + 3.1)
      g.connect(filter)
      for (const f of chord) {
        const osc = this.ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = f
        osc.connect(g)
        osc.start(t0)
        osc.stop(t0 + 3.3)
      }
    }
    playChord()
    this.musicTimer = setInterval(playChord, 3000)
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer)
      this.musicTimer = null
    }
  }

  dispose() {
    this.stopMusic()
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined)
      this.ctx = null
    }
  }
}

/** Shared singleton. */
export const audio = new AudioManager()

'use client'

/**
 * بوم چین (STACK & SMASH) - Game shell.
 * Hosts the WebGL canvas, the floaty-FX layer, all screens and the
 * engine lifecycle. Single-route game shell (mobile-first).
 */
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/lib/store'
import { GameEngine } from '@/game/engine'
import { engineRef } from '@/game/engineRef'
import { setMusicEnabled } from '@/game/audio'
import MainMenu from '@/components/game/screens/MainMenu'
import LevelSelect from '@/components/game/screens/LevelSelect'
import SettingsScreen from '@/components/game/screens/SettingsScreen'
import Shop from '@/components/game/screens/Shop'
import Leaderboard from '@/components/game/screens/Leaderboard'
import AdminPanel from '@/components/game/screens/AdminPanel'
import Hud from '@/components/game/hud/Hud'
import { Toaster } from '@/components/ui/toaster'
import { LoseOverlay, PauseOverlay, WinOverlay, BriefingOverlay } from '@/components/game/hud/Overlays'

export default function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fxRef = useRef<HTMLDivElement>(null)

  const screen = useGameStore((s) => s.screen)
  const status = useGameStore((s) => s.status)
  const settings = useGameStore((s) => s.settings)
  const skin = useGameStore((s) => s.items.skin)
  const runNonce = useGameStore((s) => s.runNonce)

  // load saved progress (localStorage + server)
  useEffect(() => {
    void useGameStore.getState().hydrate()
  }, [])

  // engine lifecycle: (re)created for every level run
  useEffect(() => {
    if (screen !== 'game' || !canvasRef.current || !fxRef.current) return
    const engine = new GameEngine(canvasRef.current, fxRef.current, useGameStore.getState().currentLevel, {
      onScore: (delta) => useGameStore.getState().addScore(delta),
      onCombo: (combo) => useGameStore.getState().setCombo(combo),
      onShots: (shots) => useGameStore.getState().setShots(shots),
      onGoal: (current, target) => useGameStore.getState().setGoalProgress(current, target),
      onBombArmed: (armed) => useGameStore.getState().setBombArmed(armed),
      onBombConsumed: () => useGameStore.getState().consumeBomb(),
      onBallActive: (active) => useGameStore.getState().setBallActive(active),
      onWin: (score) => useGameStore.getState().finishWin(score),
      onLose: (reason) => useGameStore.getState().finishLose(reason),
    })
    engineRef.current = engine
    if (process.env.NODE_ENV !== 'production') {
      ;(window as unknown as { __ssEngine?: unknown }).__ssEngine = engine
    }
    engine.applySettings(useGameStore.getState().settings)
    engine.applySkin(useGameStore.getState().items.skin)
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [screen, runNonce])

  // pause propagation
  useEffect(() => {
    engineRef.current?.setPaused(status !== 'playing')
  }, [status])

  // live settings propagation
  useEffect(() => {
    engineRef.current?.applySettings(settings)
  }, [settings])

  // background music: global (not engine-scoped) — follows the settings toggle
  useEffect(() => {
    setMusicEnabled(settings.music)
  }, [settings.music])

  // ball skin propagation
  useEffect(() => {
    engineRef.current?.applySkin(skin)
  }, [skin])

  // auto-pause when the tab is hidden
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) useGameStore.getState().pause()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#a8ecd9] font-sans">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {/* floating score / combo texts (3D-projected) */}
      <div ref={fxRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />

      {screen === 'game' && <Hud />}
      {screen === 'game' && status === 'briefing' && <BriefingOverlay />}
      {screen === 'game' && status === 'paused' && <PauseOverlay />}
      {screen === 'game' && status === 'won' && <WinOverlay />}
      {screen === 'game' && status === 'lost' && <LoseOverlay />}

      {screen === 'menu' && <MainMenu />}
      {screen === 'levels' && <LevelSelect />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'shop' && <Shop />}
      {screen === 'ranks' && <Leaderboard />}
      {screen === 'admin' && <AdminPanel />}

      {/* app-wide toast notifications */}
      <Toaster />
    </div>
  )
}

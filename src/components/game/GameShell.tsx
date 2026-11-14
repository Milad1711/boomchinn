'use client'

/**
 * STACK & SMASH - Game shell.
 * Hosts the WebGL canvas, the floaty-FX layer, all screens and the
 * engine lifecycle. Single-route game shell (mobile-first).
 */
import { useEffect, useRef } from 'react'
import { useGameStore } from '@/lib/store'
import { audio } from '@/game/audio'
import { GameEngine } from '@/game/engine'
import { engineRef } from '@/game/engineRef'
import MainMenu from '@/components/game/screens/MainMenu'
import LevelSelect from '@/components/game/screens/LevelSelect'
import SettingsScreen from '@/components/game/screens/SettingsScreen'
import Shop from '@/components/game/screens/Shop'
import Hud from '@/components/game/hud/Hud'
import { LoseOverlay, PauseOverlay, WinOverlay } from '@/components/game/hud/Overlays'

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

  // audio unlock + UI click sounds
  useEffect(() => {
    const unlock = () => audio.unlock()
    const click = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('button')) audio.click()
    }
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('click', click)
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('click', click)
    }
  }, [])

  // music / sfx toggle
  useEffect(() => {
    audio.applySettings(settings.sfx, settings.music)
  }, [settings.sfx, settings.music])

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
      onWin: (score) => useGameStore.getState().finishWin(score),
      onLose: (reason) => useGameStore.getState().finishLose(reason),
    })
    engineRef.current = engine
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

      {/* shooting strip hint (touches pass through to the canvas) */}
      {screen === 'game' && status === 'playing' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] flex h-[16%] items-start justify-center border-t border-white/30 bg-white/10 pt-1.5">
          <span className="rounded-full bg-white/45 px-3 py-0.5 text-[10px] font-bold text-teal-900/70">
            ناحیه‌ی شلیک
          </span>
        </div>
      )}

      {/* floating score / combo texts (3D-projected) */}
      <div ref={fxRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />

      {screen === 'game' && <Hud />}
      {screen === 'game' && status === 'paused' && <PauseOverlay />}
      {screen === 'game' && status === 'won' && <WinOverlay />}
      {screen === 'game' && status === 'lost' && <LoseOverlay />}

      {screen === 'menu' && <MainMenu />}
      {screen === 'levels' && <LevelSelect />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'shop' && <Shop />}
    </div>
  )
}

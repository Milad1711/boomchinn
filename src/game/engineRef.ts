/**
 * Global engine reference so React components (HUD buttons) can call
 * engine methods without prop drilling. Assigned by GameShell.
 */
import type { GameEngine } from './engine'

export const engineRef: { current: GameEngine | null } = { current: null }

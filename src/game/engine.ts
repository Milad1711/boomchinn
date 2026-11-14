/**
 * بوم چین (STACK & SMASH) - 3D game engine.
 * Three.js (render) + cannon-es (physics).
 *
 * Systems:
 *  - Mergeable objects with 5 tiers; two same-tier objects merge on contact.
 *  - Drag & drop touch input (kinematic hold).
 *  - Guided-missile cannon: tap an obstacle and the turret fires a homing
 *    rocket that ALWAYS hits it. Precise, zero wasted shots, clear role.
 *  - Destructible obstacles (wood crate / glass crystal / stone) with
 *    floating HP bars, splash damage and chain reactions.
 *  - Timed auto-spawn waves keep levels long and never dead-end.
 *  - Idle auto-hint: after a few seconds the game itself highlights the
 *    two closest mergeable items.
 *  - Combos, score, goal tracking, win/lose detection.
 *  - Particles, debris, shockwaves, floaties, shake, sounds, haptics.
 */
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import * as CANNON from 'cannon-es'
import { LEVELS } from './levels'
import {
  TIERS,
  MAX_TIER,
  OBSTACLE_STYLE,
  MISSILE_DMG,
  BOMB_DMG,
  BOMB_SPLASH_DMG,
  type LevelDef,
  type ObstacleKind,
} from './types'
import { BALL_SKINS, type Settings } from '@/lib/store'
import { faNum } from '@/lib/format'
import { audio } from './audio'
import { Effects } from './effects'

export interface EngineCallbacks {
  onScore: (delta: number) => void
  onCombo: (combo: number) => void
  onShots: (shots: number) => void
  onGoal: (current: number, target: number) => void
  onBombArmed: (armed: boolean) => void
  onBombConsumed: () => void
  onBallActive: (active: boolean) => void
  onWin: (score: number) => void
  onLose: (reason: string) => void
}

interface MergeItem {
  body: CANNON.Body
  mesh: THREE.Mesh
  tier: number
  born: number
  held: boolean
  consumed: boolean
}

interface ObstacleItem {
  body: CANNON.Body
  mesh: THREE.Mesh
  w: number
  h: number
  d: number
  hp: number
  maxHp: number
  kind: ObstacleKind
  flash: number
  dead: boolean
  hpSprite: THREE.Sprite
  hpCanvas: HTMLCanvasElement
  hpCtx: CanvasRenderingContext2D
  hpTex: THREE.CanvasTexture
}

/** Homing rocket: pure visual flight along a bezier arc, always hits. */
interface MissileItem {
  mesh: THREE.Mesh
  from: THREE.Vector3
  ctrl: THREE.Vector3
  target: ObstacleItem | null
  t: number
  dur: number
  bomb: boolean
  trailTimer: number
}

interface CollideEvt {
  body: CANNON.Body
  contact: CANNON.ContactEquation
  target: CANNON.Body
}

const HOLD_Y = 1.15
const AIM_ELEVATION = 0.5 // barrel pitch (visual)
const MAX_AIM_ANGLE = 1.15
const GRAVITY = 16
const MISSILE_Y = 1.05 // launch height

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

export class GameEngine {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private camBase = new THREE.Vector3()
  private camLook = new THREE.Vector3()

  private world: CANNON.World
  private matGround = new CANNON.Material('ground')
  private matObj = new CANNON.Material('obj')

  private canvas: HTMLCanvasElement
  private levelIndex: number
  private def: LevelDef
  private cb: EngineCallbacks
  private fx: Effects
  private settings: Settings

  private items = new Map<number, MergeItem>()
  private obstacles: ObstacleItem[] = []
  private missiles: MissileItem[] = []

  private tierGeos: THREE.BufferGeometry[] = []
  private obstacleGeo: THREE.BufferGeometry
  private woodTex: THREE.CanvasTexture
  private stoneTex: THREE.CanvasTexture

  // state
  private time = 0
  private clock = new THREE.Clock()
  private rafId = 0
  private paused = false
  private disposed = false
  private score = 0
  private combo = 0
  private comboUntil = 0
  private shots = 0
  private shotsFired = 0
  private bombArmed = false
  private goalCurrent = 0
  private won = false
  private winAt = 0
  private winFired = false
  private lost = false
  private loseReason = ''
  private lostAt = 0
  private loseFired = false
  private stuckSince = 0
  private warnedStuck = false
  private failTimer = 0
  private lastBreakTime = -10
  private lastShotTime = -10
  private shake = 0
  private skinId = 'classic'
  private lastBallColor = '#f97316'

  // merge pipeline
  private pendingPairs = new Map<string, [MergeItem, MergeItem]>()

  // auto-spawn wave (keeps the tray supplied)
  private autoTier = 0
  private autoLeft = 0
  private autoNextAt = 0
  private autoInterval = 4
  private autoMax = 9

  // idle auto-hint (the game itself points out two mergeable items)
  private lastActionTime = 0
  private hintPulseNext = 0
  private hintTextShown = false

  // input
  private raycaster = new THREE.Raycaster()
  private ndc = new THREE.Vector2()
  private held: MergeItem | null = null
  private holdPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -HOLD_Y)
  private dragPoint = new THREE.Vector3()
  private aimAngle = 0

  // guided turret visuals
  private cannonGroup = new THREE.Group()
  private barrelGroup = new THREE.Group()
  private cannonPos = new THREE.Vector3()
  private cannonRangeX = 4
  private recoil = 0
  private canShoot = false
  private cannonReady = false

  // target reticle
  private reticle: THREE.Group | null = null
  private reticleMat: THREE.MeshBasicMaterial | null = null

  // tutorial pulses
  private tPulseUntil = 0
  private tPulseNext = 0
  private tMergeHintShown = false
  private tShotHintCount = 0
  private tShotHintNext = 6.5

  // shared listeners
  private onItemCollide = (evt: CollideEvt) => this.queuePair(evt)
  private onResize = () => this.layout()

  constructor(
    canvas: HTMLCanvasElement,
    fxLayer: HTMLElement,
    levelIndex: number,
    cb: EngineCallbacks
  ) {
    this.canvas = canvas
    this.levelIndex = levelIndex
    this.def = LEVELS[levelIndex] ?? LEVELS[0]
    this.cb = cb
    this.shots = this.def.shots
    this.settings = { sfx: true, music: true, haptics: true, shadows: true }

    // ---------------------------------------------------------- renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap

    // ------------------------------------------------------------- scene
    this.scene = new THREE.Scene()
    this.scene.background = this.makeGradientTexture()
    this.scene.fog = new THREE.Fog(0xa9ecd9, 32, 72)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.5
    pmrem.dispose()

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 120)

    const hemi = new THREE.HemisphereLight(0xf6fffa, 0x2b9a7c, 0.85)
    this.scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff8ec, 1.75)
    sun.position.set(7, 14, 6)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -11
    sun.shadow.camera.right = 11
    sun.shadow.camera.top = 11
    sun.shadow.camera.bottom = -11
    sun.shadow.camera.far = 40
    sun.shadow.bias = -0.0004
    this.scene.add(sun)

    // ----------------------------------------------------------- physics
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY, 0) })
    this.world.broadphase = new CANNON.SAPBroadphase(this.world)
    this.world.allowSleep = true
    ;(this.world.solver as CANNON.GSSolver).iterations = 10
    this.world.defaultContactMaterial.friction = 0.35
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.matGround, this.matObj, { friction: 0.38, restitution: 0.12 }))
    this.world.addContactMaterial(new CANNON.ContactMaterial(this.matObj, this.matObj, { friction: 0.32, restitution: 0.18 }))

    const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: this.matGround })
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    this.world.addBody(floorBody)

    // ------------------------------------------------------------- world
    this.woodTex = this.makeWoodTexture()
    this.stoneTex = this.makeStoneTexture()
    this.buildEnvironment()
    this.obstacleGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.09)
    this.buildCannon()
    this.buildReticle()
    for (const s of this.def.spawns) this.makeItem(s.tier, s.x, 1.7, s.z)
    for (const o of this.def.obstacles) this.makeObstacle(o)

    // timed auto-spawn wave
    const auto = this.def.autoSpawn
    if (auto) {
      this.autoTier = auto.tier
      this.autoLeft = auto.count
      this.autoInterval = auto.interval
      this.autoMax = auto.maxOnTray ?? 9
      this.autoNextAt = this.time + this.autoInterval * 0.6
    }

    this.fx = new Effects(this.scene, this.camera, fxLayer)

    // ------------------------------------------------------------ events
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerCancel)
    window.addEventListener('resize', this.onResize)

    const goalTarget =
      this.def.goal.type === 'merge'
        ? this.def.goal.count ?? 1
        : this.def.goal.type === 'clear'
          ? this.def.obstacles.length
          : this.def.goal.points ?? 0
    this.cb.onGoal(0, goalTarget)
    this.cb.onShots(this.shots)

    // level-1 tutorial: pulse rings under two same-tier items
    if (this.levelIndex === 0) this.tPulseUntil = 12

    this.layout()
    this.loop()
  }

  // =============================================================== build

  private makeGradientTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas')
    c.width = 2
    c.height = 512
    const ctx = c.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, '#e6fcf3')
    g.addColorStop(1, '#8ce6d2')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 2, 512)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  private makeFloorTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 256
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#c3f2df'
    ctx.fillRect(0, 0, 256, 256)
    ctx.fillStyle = '#b9efdc'
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) if ((x + y) % 2 === 0) ctx.fillRect(x * 64, y * 64, 64, 64)
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(11, 11)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }

  /** Warm wooden planks texture for crates. */
  private makeWoodTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 128
    const ctx = c.getContext('2d')!
    const shades = ['#cf9058', '#c68a52', '#d29a63', '#c2854f']
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = shades[i]
      ctx.fillRect(0, i * 32, 128, 32)
      // grain streaks
      ctx.strokeStyle = 'rgba(122,74,38,0.28)'
      ctx.lineWidth = 1.4
      for (let g = 0; g < 3; g++) {
        const gy = i * 32 + 6 + g * 9 + Math.random() * 4
        ctx.beginPath()
        ctx.moveTo(4, gy)
        ctx.bezierCurveTo(40, gy - 3, 80, gy + 3, 124, gy)
        ctx.stroke()
      }
      // plank separator
      ctx.fillStyle = 'rgba(96,58,28,0.75)'
      ctx.fillRect(0, i * 32, 128, 2.4)
    }
    // nails
    ctx.fillStyle = '#7a4a26'
    for (const [nx, ny] of [[8, 6], [120, 6], [8, 122], [120, 122]]) {
      ctx.beginPath()
      ctx.arc(nx, ny, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }

  /** Speckled granite texture for stones. */
  private makeStoneTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 128
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#a7b3ad'
    ctx.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 260; i++) {
      const shade = Math.random()
      ctx.fillStyle =
        shade > 0.6 ? 'rgba(120,132,126,0.5)' : shade > 0.25 ? 'rgba(178,190,184,0.5)' : 'rgba(88,100,94,0.4)'
      ctx.beginPath()
      ctx.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 3.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(84,96,90,0.5)'
    ctx.lineWidth = 1.6
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      const sx = Math.random() * 128
      const sy = Math.random() * 128
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx + (Math.random() - 0.5) * 60, sy + (Math.random() - 0.5) * 60)
      ctx.stroke()
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }

  private buildEnvironment() {
    const { trayW: W, trayD: D } = this.def
    const t = 0.5
    const wallH = 1.7
    const frontH = 0.85

    // outer ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ map: this.makeFloorTexture(), roughness: 0.85, metalness: 0 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.01
    ground.receiveShadow = true
    this.scene.add(ground)

    // tray inner floor
    const tray = new THREE.Mesh(
      new THREE.PlaneGeometry(W, D),
      new THREE.MeshStandardMaterial({ color: 0xeefcf5, roughness: 0.5, metalness: 0.02 })
    )
    tray.rotation.x = -Math.PI / 2
    tray.position.y = 0.005
    tray.receiveShadow = true
    this.scene.add(tray)

    // walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x77dbc3, roughness: 0.35, metalness: 0.05 })
    const addWall = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.1), wallMat)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.scene.add(mesh)
      const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
        material: this.matGround,
      })
      body.position.set(x, y, z)
      this.world.addBody(body)
    }
    addWall(W + 2 * t, wallH, t, 0, wallH / 2, -D / 2 - t / 2) // back
    addWall(W + 2 * t, frontH, t, 0, frontH / 2, D / 2 + t / 2) // front (low)
    addWall(t, wallH, D, -W / 2 - t / 2, wallH / 2, 0) // left
    addWall(t, wallH, D, W / 2 + t / 2, wallH / 2, 0) // right
  }

  private buildCannon() {
    // no obstacles -> no cannon needed (missiles only target obstacles)
    if (this.def.obstacles.length === 0) return
    const { trayW: W, trayD: D } = this.def
    this.cannonPos.set(0, 0, D / 2 + 1.35)
    this.cannonRangeX = W / 2 + 0.7
    this.cannonGroup.position.copy(this.cannonPos)
    this.cannonReady = true

    // plinth base (dark teal)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.64, 0.76, 0.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x1e5c4e, roughness: 0.45, metalness: 0.3 })
    )
    base.position.y = 0.25
    base.castShadow = true
    this.cannonGroup.add(base)

    // amber accent ring
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.58, 0.1, 24),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.4 })
    )
    ring.position.y = 0.53
    this.cannonGroup.add(ring)

    // rotating turret + barrel (recoils on fire)
    const pivot = new THREE.Group()
    pivot.position.y = 0.72
    pivot.rotation.x = -AIM_ELEVATION
    this.barrelGroup.position.z = 0
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.28, 1.6, 18),
      new THREE.MeshStandardMaterial({ color: 0x2c7a68, roughness: 0.3, metalness: 0.5 })
    )
    barrel.rotation.x = -Math.PI / 2
    barrel.position.z = -0.78
    barrel.castShadow = true
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.16, 18),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.55 })
    )
    muzzle.rotation.x = -Math.PI / 2
    muzzle.position.z = -1.5
    this.barrelGroup.add(barrel, muzzle)
    pivot.add(this.barrelGroup)
    this.cannonGroup.add(pivot)

    this.scene.add(this.cannonGroup)
  }

  /** Pulsing reticle shown on the turret's current auto-target. */
  private buildReticle() {
    if (this.def.obstacles.length === 0) return
    this.reticleMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    this.reticle = new THREE.Group()
    const outer = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.55, 32), this.reticleMat)
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.24, 24), this.reticleMat)
    outer.rotation.x = -Math.PI / 2
    inner.rotation.x = -Math.PI / 2
    outer.position.y = 0.07
    inner.position.y = 0.07
    this.reticle.add(outer, inner)
    this.reticle.visible = false
    this.scene.add(this.reticle)
  }

  private layout() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    const aspect = w / h
    this.camera.aspect = aspect
    const vFov = THREE.MathUtils.degToRad(this.camera.fov)
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const distW = (this.def.trayW / 2 + 1.4) / Math.tan(hFov / 2)
    const distD = ((this.def.trayD / 2 + 2.9) / Math.tan(vFov / 2)) * 0.72
    const dist = Math.max(distW, distD, Math.max(this.def.trayW, this.def.trayD) * 1.2)
    this.camBase.set(0, dist * 0.78, dist * 0.64)
    this.camLook.set(0, 0.1, this.def.trayD * 0.04)
    this.camera.updateProjectionMatrix()
  }

  // ============================================================ entities

  private tierGeometry(tier: number): THREE.BufferGeometry {
    if (!this.tierGeos[tier]) {
      const t = TIERS[tier]
      switch (t.shape) {
        case 'sphere':
          this.tierGeos[tier] = new THREE.SphereGeometry(t.r ?? 0.4, 22, 14)
          break
        case 'box':
          this.tierGeos[tier] = new RoundedBoxGeometry(t.s ?? 0.8, t.s ?? 0.8, t.s ?? 0.8, 3, 0.11)
          break
        case 'cylinder':
          this.tierGeos[tier] = new THREE.CylinderGeometry(t.r ?? 0.5, t.r ?? 0.5, t.h ?? 0.9, 22)
          break
        case 'ico':
          this.tierGeos[tier] = new THREE.IcosahedronGeometry(t.r ?? 0.7, 0)
          break
        case 'gem':
          this.tierGeos[tier] = new RoundedBoxGeometry(t.s ?? 1.2, (t.s ?? 1.2) * 0.74, t.s ?? 1.2, 3, 0.16)
          break
      }
    }
    return this.tierGeos[tier]
  }

  private itemRadius(tier: number): number {
    const t = TIERS[tier]
    return t.r ?? (t.s ?? 0.8) / 2
  }

  private makeItem(tier: number, x: number, y: number, z: number): MergeItem {
    const def = TIERS[tier]
    const shape = this.tierShapeFor(tier)
    const body = new CANNON.Body({
      mass: def.mass,
      shape,
      position: new CANNON.Vec3(x, y, z),
      material: this.matObj,
      angularVelocity: new CANNON.Vec3(0, (Math.random() - 0.5) * 1.5, 0),
    })
    body.linearDamping = 0.08
    body.angularDamping = 0.25
    body.allowSleep = true
    body.sleepSpeedLimit = 0.25
    body.sleepTimeLimit = 0.6
    this.world.addBody(body)

    const mat = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: 0.16,
      metalness: 0.08,
      emissive: def.color,
      emissiveIntensity: def.glow ?? 0.07,
      flatShading: def.shape === 'ico',
    })
    const mesh = new THREE.Mesh(this.tierGeometry(tier), mat)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.scene.add(mesh)

    const item: MergeItem = { body, mesh, tier, born: this.time, held: false, consumed: false }
    mesh.userData.item = item
    this.items.set(body.id, item)
    body.addEventListener('collide', this.onItemCollide)
    return item
  }

  private tierShapeFor(tier: number): CANNON.Shape {
    const t = TIERS[tier]
    switch (t.shape) {
      case 'sphere':
        return new CANNON.Sphere(t.r ?? 0.4)
      case 'box':
        return new CANNON.Box(new CANNON.Vec3((t.s ?? 0.8) / 2, (t.s ?? 0.8) / 2, (t.s ?? 0.8) / 2))
      case 'cylinder':
        return new CANNON.Cylinder(t.r ?? 0.5, t.r ?? 0.5, t.h ?? 0.9, 12)
      case 'ico':
        return new CANNON.Sphere(t.r ?? 0.7)
      case 'gem':
        return new CANNON.Box(new CANNON.Vec3((t.s ?? 1.2) / 2, ((t.s ?? 1.2) * 0.74) / 2, (t.s ?? 1.2) / 2))
    }
  }

  private removeItem(item: MergeItem) {
    if (item.consumed) return
    item.consumed = true
    item.body.removeEventListener('collide', this.onItemCollide)
    this.world.removeBody(item.body)
    this.scene.remove(item.mesh)
    ;(item.mesh.material as THREE.Material).dispose()
    this.items.delete(item.body.id)
    if (this.held === item) this.held = null
  }

  private makeObstacle(o: LevelDef['obstacles'][number]) {
    const style = OBSTACLE_STYLE[o.kind]
    const mass = o.kind === 'crate' ? 6 : o.kind === 'crystal' ? 10 : 14
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(o.w / 2, o.h / 2, o.d / 2)),
      position: new CANNON.Vec3(o.x, o.h / 2 + 0.05, o.z),
      material: this.matObj,
    })
    if (o.rot) body.quaternion.setFromEuler(0, o.rot, 0)
    body.linearDamping = 0.4
    body.angularDamping = 0.6
    body.allowSleep = true
    body.sleepSpeedLimit = 0.3
    body.sleepTimeLimit = 0.6
    this.world.addBody(body)

    // distinct look per kind: wood crate / glassy crystal / granite stone
    const mat =
      o.kind === 'crate'
        ? new THREE.MeshStandardMaterial({ map: this.woodTex, roughness: 0.62, metalness: 0.04 })
        : o.kind === 'crystal'
          ? new THREE.MeshStandardMaterial({
              color: 0x5ec9d8,
              roughness: 0.12,
              metalness: 0.1,
              transparent: true,
              opacity: 0.85,
              emissive: 0x0e7490,
              emissiveIntensity: 0.3,
            })
          : new THREE.MeshStandardMaterial({ map: this.stoneTex, roughness: 0.85, metalness: 0.02 })
    const mesh = new THREE.Mesh(this.obstacleGeo, mat)
    mesh.scale.set(o.w, o.h, o.d)
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.scene.add(mesh)

    // floating HP bar (billboard sprite, always visible)
    const hpCanvas = document.createElement('canvas')
    hpCanvas.width = 100
    hpCanvas.height = 16
    const hpCtx = hpCanvas.getContext('2d')!
    const hpTex = new THREE.CanvasTexture(hpCanvas)
    hpTex.colorSpace = THREE.SRGBColorSpace
    const hpSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: hpTex, transparent: true, depthTest: false })
    )
    hpSprite.scale.set(1.15, 0.18, 1)
    hpSprite.renderOrder = 20
    this.scene.add(hpSprite)

    const item: ObstacleItem = {
      body,
      mesh,
      w: o.w,
      h: o.h,
      d: o.d,
      hp: o.hp,
      maxHp: o.hp,
      kind: o.kind,
      flash: 0,
      dead: false,
      hpSprite,
      hpCanvas,
      hpCtx,
      hpTex,
    }
    this.obstacles.push(item)
    this.drawHpBar(item)
  }

  private drawHpBar(o: ObstacleItem) {
    const ctx = o.hpCtx
    const w = o.hpCanvas.width
    const h = o.hpCanvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(15,60,52,0.75)'
    roundedRectPath(ctx, 0, 0, w, h, h / 2)
    ctx.fill()
    const ratio = Math.max(0, o.hp / o.maxHp)
    if (ratio > 0) {
      ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#fbbf24' : '#fb7185'
      roundedRectPath(ctx, 2.5, 2.5, (w - 5) * ratio, h - 5, (h - 5) / 2)
      ctx.fill()
    }
    o.hpTex.needsUpdate = true
  }

  private removeObstacle(o: ObstacleItem) {
    o.dead = true
    this.world.removeBody(o.body)
    this.scene.remove(o.mesh)
    this.scene.remove(o.hpSprite)
    ;(o.mesh.material as THREE.Material).dispose()
    ;(o.hpSprite.material as THREE.SpriteMaterial).dispose()
    o.hpTex.dispose()
    this.obstacles = this.obstacles.filter((x) => x !== o)
  }

  // =============================================================== input

  private setNdc(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect()
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  private onPointerDown = (e: PointerEvent) => {
    audio.unlock()
    if (this.paused || this.won || this.lost || this.disposed) return
    this.setNdc(e)
    this.lastActionTime = this.time
    this.hintTextShown = false

    // 1) pick a mergeable object
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const meshes: THREE.Mesh[] = []
    for (const it of this.items.values()) if (!it.consumed) meshes.push(it.mesh)
    const hits = this.raycaster.intersectObjects(meshes, false)
    if (hits.length > 0) {
      const item = hits[0].object.userData.item as MergeItem
      this.held = item
      item.held = true
      item.body.type = CANNON.Body.KINEMATIC
      item.body.velocity.setZero()
      item.body.angularVelocity.scale(0.2, item.body.angularVelocity)
      item.body.wakeUp()
      this.holdPlane.set(new THREE.Vector3(0, 1, 0), -HOLD_Y)
      this.updateDragPoint()
      audio.pick()
      this.canvas.setPointerCapture(e.pointerId)
      return
    }

    // 2) tap an obstacle -> fire a guided missile at it (always hits)
    const obMeshes = this.obstacles.map((o) => o.mesh)
    const obHits = this.raycaster.intersectObjects(obMeshes, false)
    if (obHits.length > 0) {
      const obstacle = this.obstacles.find((o) => o.mesh === obHits[0].object)
      if (obstacle) this.fireMissileAt(obstacle)
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.disposed) return
    if (this.held) {
      this.setNdc(e)
      this.updateDragPoint()
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    if (this.disposed) return
    if (this.held) this.releaseHeld()
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId)
  }

  private onPointerCancel = () => {
    if (this.disposed) return
    if (this.held) this.releaseHeld()
  }

  private releaseHeld() {
    const item = this.held
    if (!item) return
    item.held = false
    item.body.type = CANNON.Body.DYNAMIC
    item.body.mass = TIERS[item.tier].mass
    item.body.updateMassProperties()
    item.body.velocity.set(item.body.velocity.x * 0.4, 0, item.body.velocity.z * 0.4)
    item.body.wakeUp()
    this.held = null
    this.lastActionTime = this.time
  }

  private updateDragPoint() {
    if (!this.held) return
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hit = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(this.holdPlane, hit)) return
    const r = this.itemRadius(this.held.tier)
    const hw = this.def.trayW / 2 - r - 0.08
    const hd = this.def.trayD / 2 - r - 0.08
    hit.x = THREE.MathUtils.clamp(hit.x, -hw, hw)
    hit.z = THREE.MathUtils.clamp(hit.z, -hd, hd)
    hit.y = HOLD_Y
    this.dragPoint.copy(hit)
  }

  // =============================================================== combat

  /** Fire a guided missile from the turret at the tapped obstacle. */
  private fireMissileAt(target: ObstacleItem) {
    if (!this.cannonReady || this.shots <= 0 || this.won || this.lost || target.dead) return
    this.shots--
    this.shotsFired++
    this.lastShotTime = this.time
    this.lastActionTime = this.time
    this.hintTextShown = false
    this.cb.onShots(this.shots)

    let bomb = false
    if (this.bombArmed) {
      bomb = true
      this.bombArmed = false
      this.cb.onBombArmed(false)
      this.cb.onBombConsumed()
    }

    // snap the turret toward the target, then launch from the muzzle
    const dx = target.body.position.x - this.cannonGroup.position.x
    const dz = target.body.position.z - this.cannonPos.z
    this.aimAngle = THREE.MathUtils.clamp(Math.atan2(dx, -dz), -MAX_AIM_ANGLE, MAX_AIM_ANGLE)

    const dir = new THREE.Vector3(Math.sin(this.aimAngle), 0, -Math.cos(this.aimAngle))
    const from = new THREE.Vector3(
      this.cannonGroup.position.x + dir.x * 1.1,
      MISSILE_Y,
      this.cannonPos.z + dir.z * 1.1
    )
    const to = new THREE.Vector3(target.body.position.x, target.body.position.y, target.body.position.z)
    const dist = from.distanceTo(to)
    const ctrl = from.clone().add(to).multiplyScalar(0.5)
    ctrl.y += Math.min(2.2, 0.9 + dist * 0.22)

    audio.shoot()
    this.buzz(25)
    this.shake = Math.max(this.shake, 0.14)
    this.recoil = 1
    this.fx.burst(from, '#ffd27a', 10, 3.4, 1.4)

    const skin = BALL_SKINS.find((s) => s.id === this.skinId) ?? BALL_SKINS[0]
    this.lastBallColor = skin.color
    const mat = new THREE.MeshStandardMaterial({
      color: bomb ? '#ffb14d' : skin.color,
      roughness: 0.25,
      metalness: 0.4,
      emissive: new THREE.Color(bomb ? '#ff7a1f' : skin.color),
      emissiveIntensity: bomb ? 0.8 : 0.35,
    })
    const geo = new THREE.CapsuleGeometry(0.13, 0.3, 4, 10)
    geo.rotateX(Math.PI / 2) // length along Z so lookAt points the nose forward
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(from)
    this.scene.add(mesh)

    this.missiles.push({
      mesh,
      from,
      ctrl,
      target,
      t: 0,
      dur: THREE.MathUtils.clamp(0.38 + dist * 0.05, 0.5, 0.95),
      bomb,
      trailTimer: 0,
    })
    this.cb.onBallActive(true)
  }

  /** Bezier flight + live retargeting + impact. */
  private updateMissiles(dt: number) {
    for (const m of [...this.missiles]) {
      m.t += dt / m.dur

      // target vanished (destroyed by something else) -> steer to a new one
      if (m.target?.dead) {
        m.target = this.nearestObstacle(m.mesh.position)
        if (m.target) {
          m.from.copy(m.mesh.position)
          const to = new THREE.Vector3(m.target.body.position.x, m.target.body.position.y, m.target.body.position.z)
          const dist = m.from.distanceTo(to)
          m.ctrl = m.from.clone().add(to).multiplyScalar(0.5)
          m.ctrl.y += Math.min(1.8, 0.6 + dist * 0.2)
          m.t = 0
          m.dur = THREE.MathUtils.clamp(0.3 + dist * 0.05, 0.35, 0.7)
        }
      }

      const end =
        m.target && !m.target.dead
          ? new THREE.Vector3(m.target.body.position.x, m.target.body.position.y, m.target.body.position.z)
          : m.mesh.position.clone()

      const t = Math.min(m.t, 1)
      const a = m.from.clone().lerp(m.ctrl, t)
      const b = m.ctrl.clone().lerp(end, t)
      const pos = a.lerp(b, t)
      const vel = pos.clone().sub(m.mesh.position)
      m.mesh.position.copy(pos)
      if (vel.lengthSq() > 1e-6) m.mesh.lookAt(pos.clone().add(vel))

      // exhaust trail
      m.trailTimer += dt
      if (m.trailTimer > 0.03) {
        m.trailTimer = 0
        this.fx.burst(pos, m.bomb ? '#ffb14d' : this.lastBallColor, 2, 0.6, 0.35)
      }

      if (m.t >= 1) {
        this.missiles = this.missiles.filter((x) => x !== m)
        this.scene.remove(m.mesh)
        m.mesh.geometry.dispose()
        ;(m.mesh.material as THREE.Material).dispose()
        this.impactMissile(m)
      }
    }
    if (this.missiles.length === 0) this.cb.onBallActive(false)
  }

  /** Damage, splash, physics impulse and FX exactly where the missile lands. */
  private impactMissile(m: MissileItem) {
    const p = new THREE.Vector3(m.mesh.position.x, Math.max(0.4, m.mesh.position.y), m.mesh.position.z)
    const c = new CANNON.Vec3(p.x, p.y, p.z)
    if (m.bomb) {
      this.fx.burst(p, '#ffb14d', 40, 7, 3)
      this.fx.ring(p, '#ffb14d', 3.6)
      audio.blast()
      this.shake = Math.max(this.shake, 0.7)
      this.buzz(70)
      this.explode(c, 3.4, 9)
      this.splashDamage(c, 3.2, BOMB_SPLASH_DMG)
      if (m.target && !m.target.dead) this.damageObstacle(m.target, BOMB_DMG, c)
      return
    }
    this.fx.burst(p, '#ffffff', 8, 2.4, 1)
    this.shake = Math.max(this.shake, 0.18)
    this.explode(c, 2.4, 4)
    this.splashDamage(c, 1.5, 6)
    if (m.target && !m.target.dead) this.damageObstacle(m.target, MISSILE_DMG[m.target.kind], c)
    else audio.thud()
  }

  private nearestObstacle(from: THREE.Vector3): ObstacleItem | null {
    let best: ObstacleItem | null = null
    let bestD = Infinity
    for (const o of this.obstacles) {
      if (o.dead) continue
      const d = Math.hypot(o.body.position.x - from.x, o.body.position.z - from.z)
      if (d < bestD) {
        bestD = d
        best = o
      }
    }
    return best
  }

  private damageObstacle(o: ObstacleItem, dmg: number, from: CANNON.Vec3) {
    if (o.dead || this.won) return
    o.hp -= dmg
    o.flash = 1
    this.drawHpBar(o)
    audio.crack()
    this.fx.burst(new THREE.Vector3(from.x, Math.max(0.3, from.y), from.z), OBSTACLE_STYLE[o.kind].color, 8, 3, 1)
    if (o.hp <= 0) this.destroyObstacle(o)
  }

  private destroyObstacle(o: ObstacleItem) {
    if (o.dead) return
    const p = new THREE.Vector3(o.body.position.x, o.body.position.y, o.body.position.z)
    const color = OBSTACLE_STYLE[o.kind].color
    this.removeObstacle(o)
    this.lastBreakTime = this.time

    this.addScore(50, p.clone().setY(1.2))
    this.fx.debrisBurst(p, color, 8)
    this.fx.burst(p, color, 26, 5.5, 2.6)
    this.fx.ring(p, color, 2.3)
    audio.break_()
    this.buzz(35)
    this.shake = Math.max(this.shake, 0.42)

    // chain reactions: splash + impulse
    this.explode(o.body.position, 2.9, 5)
    this.splashDamage(o.body.position, 1.9, 12)

    if (this.def.goal.type === 'clear') {
      this.cb.onGoal(this.def.obstacles.length - this.obstacles.length, this.def.obstacles.length)
      this.checkWin()
    }
  }

  private splashDamage(center: CANNON.Vec3, radius: number, dmg: number) {
    for (const o of [...this.obstacles]) {
      if (o.dead) continue
      const d = o.body.position.distanceTo(center)
      if (d < radius) this.damageObstacle(o, dmg * (1 - d / radius) + 4, center)
    }
  }

  private explode(center: CANNON.Vec3, radius: number, strength: number) {
    for (const item of this.items.values()) {
      const d = item.body.position.distanceTo(center)
      if (d > radius || item.held) continue
      item.body.wakeUp()
      const dir = item.body.position.vsub(center)
      dir.y = Math.abs(dir.y) + 1.2
      dir.normalize()
      const power = strength * (1 - d / radius) * (TIERS[item.tier].mass * 0.6 + 1)
      item.body.applyImpulse(dir.scale(power))
    }
  }

  // ================================================================ merge

  private queuePair(evt: CollideEvt) {
    const a = this.items.get(evt.target.id)
    const b = this.items.get(evt.body.id)
    if (!a || !b || a.consumed || b.consumed) return
    if (a.tier !== b.tier) return
    const key = a.body.id < b.body.id ? `${a.body.id}_${b.body.id}` : `${b.body.id}_${a.body.id}`
    if (!this.pendingPairs.has(key)) this.pendingPairs.set(key, [a, b])
  }

  private processMerges() {
    if (this.pendingPairs.size === 0) return
    const pairs = [...this.pendingPairs.values()]
    this.pendingPairs.clear()
    for (const [a, b] of pairs) {
      if (a.consumed || b.consumed || a.tier !== b.tier) continue
      if (!this.items.has(a.body.id) || !this.items.has(b.body.id)) continue
      this.doMerge(a, b)
    }
  }

  private doMerge(a: MergeItem, b: MergeItem) {
    this.lastActionTime = this.time
    this.hintTextShown = false
    const mid = new THREE.Vector3(
      (a.body.position.x + b.body.position.x) / 2,
      Math.max(a.body.position.y, b.body.position.y),
      (a.body.position.z + b.body.position.z) / 2
    )
    // clamp inherited velocity so merged items never rocket through walls
    const vx = THREE.MathUtils.clamp((a.body.velocity.x + b.body.velocity.x) / 2, -3.5, 3.5)
    const vz = THREE.MathUtils.clamp((a.body.velocity.z + b.body.velocity.z) / 2, -3.5, 3.5)
    const tier = a.tier
    const color = TIERS[tier].color
    this.removeItem(a)
    this.removeItem(b)

    // ---- STAR BLAST: two max-tier gems explode
    if (tier >= MAX_TIER) {
      this.addScore(500, mid.clone().setY(1.6))
      this.fx.floatText('انفجار ستاره‌ای!', mid.clone().setY(2.2), 'big')
      this.fx.burst(mid, '#e879f9', 60, 8, 4)
      this.fx.burst(mid, '#ffffff', 30, 6, 3)
      this.fx.ring(mid, '#e879f9', 4.2)
      audio.blast()
      this.buzz(90)
      this.shake = Math.max(this.shake, 0.8)
      const c = new CANNON.Vec3(mid.x, mid.y, mid.z)
      this.explode(c, 3.8, 10)
      this.splashDamage(c, 3.2, 50)
      return
    }

    const newTier = tier + 1
    const r = this.itemRadius(newTier)
    const sx = THREE.MathUtils.clamp(mid.x, -(this.def.trayW / 2 - r - 0.05), this.def.trayW / 2 - r - 0.05)
    const sz = THREE.MathUtils.clamp(mid.z, -(this.def.trayD / 2 - r - 0.05), this.def.trayD / 2 - r - 0.05)
    const item = this.makeItem(newTier, sx, Math.max(0.9, mid.y), sz)
    item.body.velocity.set(vx, 3.2, vz)
    item.born = this.time

    // combo & score
    if (this.time < this.comboUntil) this.combo++
    else this.combo = 1
    this.comboUntil = this.time + 1.35
    const mult = Math.min(1 + (this.combo - 1) * 0.25, 3)
    const gained = Math.round(TIERS[newTier].score * mult)
    this.addScore(gained, mid.clone().setY(mid.y + 1.1))
    this.cb.onCombo(this.combo)

    // fx
    this.fx.burst(mid, color, 22 + newTier * 6, 4.5 + newTier, 2.4)
    this.fx.ring(mid, color, 1.6 + newTier * 0.5)
    audio.merge(newTier)
    this.buzz(18 + newTier * 12)
    if (newTier === MAX_TIER) {
      this.fx.floatText('ستاره‌ی درخشان!', mid.clone().setY(2.1), 'big')
      this.fx.burst(mid, '#ffffff', 24, 6, 3)
      this.shake = Math.max(this.shake, 0.3)
    }

    // goal
    if (this.def.goal.type === 'merge' && newTier === this.def.goal.tier) {
      this.goalCurrent++
      this.cb.onGoal(this.goalCurrent, this.def.goal.count ?? 1)
      this.checkWin()
    }
  }

  private addScore(n: number, floatyPos?: THREE.Vector3) {
    if (n === 0) return
    this.score += n
    this.cb.onScore(n)
    if (floatyPos) this.fx.floatText(`+${faNum(n)}`, floatyPos, 'score')
    if (this.def.goal.type === 'score') {
      const target = this.def.goal.points ?? 0
      this.cb.onGoal(Math.min(this.score, target), target)
      this.checkWin()
    }
  }

  // ======================================================= win / lose

  private checkWin() {
    if (this.won || this.lost) return
    const g = this.def.goal
    let done = false
    if (g.type === 'merge') done = this.goalCurrent >= (g.count ?? 1)
    else if (g.type === 'clear') done = this.obstacles.length === 0
    else done = this.score >= (g.points ?? Infinity)
    if (!done) return
    this.won = true
    this.winAt = this.time
    audio.win()
    this.buzz([40, 60, 40, 60, 80])
    // confetti
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Vector3((Math.random() - 0.5) * this.def.trayW * 0.8, 1.5, (Math.random() - 0.5) * this.def.trayD * 0.7)
      this.fx.burst(p, ['#f43f5e', '#fbbf24', '#2dd4bf', '#b18cfe', '#ff8f6b'][i], 24, 6, 4)
    }
  }

  private checkFail() {
    if (this.won || this.lost || this.time < 2.5) return
    if (this.def.goal.type === 'clear') {
      if (
        this.shots === 0 &&
        this.missiles.length === 0 &&
        !this.bombArmed &&
        this.obstacles.length > 0 &&
        this.time - this.lastBreakTime > 1.6 &&
        this.time - this.lastShotTime > 1.4
      ) {
        this.lose('موشک‌ها تمام شد ولی موانع باقی مانده‌اند!')
      }
      return
    }
    // stuck detection (no possible merge left)
    let pairs = false
    const counts = new Map<number, number>()
    for (const it of this.items.values()) counts.set(it.tier, (counts.get(it.tier) ?? 0) + 1)
    for (const c of counts.values()) if (c >= 2) pairs = true
    // pending auto-spawn drops always keep the game solvable
    if (pairs || this.held || this.pendingPairs.size > 0 || this.autoLeft > 0) {
      this.stuckSince = 0
      this.warnedStuck = false
      return
    }
    // for score goals, breaking obstacles still earns points
    if (
      this.def.goal.type === 'score' &&
      this.obstacles.length > 0 &&
      (this.shots > 0 || this.missiles.length > 0 || this.bombArmed)
    )
      return
    if (this.stuckSince === 0) {
      this.stuckSince = this.time
      if (!this.warnedStuck) {
        this.warnedStuck = true
        this.fx.floatText('حرکت ممکنی نماند!', new THREE.Vector3(0, 2.4, 0), 'big')
      }
    } else if (this.time - this.stuckSince > 2.2) this.lose('حرکت ممکنی نماند!')
  }

  private lose(reason: string) {
    if (this.won || this.lost) return
    this.lost = true
    this.loseReason = reason
    this.lostAt = this.time
    if (this.held) this.releaseHeld()
    audio.lose()
    this.buzz([60, 40, 60])
  }

  // ================================================================ loop

  private loop = () => {
    if (this.disposed) return
    this.rafId = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    if (this.paused) {
      this.render()
      return
    }
    this.time += dt

    // physics
    this.world.step(1 / 60, dt, 3)
    this.processMerges()

    // held object follows finger (kinematic velocity steering)
    if (this.held) {
      const b = this.held.body
      const dx = this.dragPoint.x - b.position.x
      const dz = this.dragPoint.z - b.position.z
      const vx = THREE.MathUtils.clamp(dx * 14, -22, 22)
      const vz = THREE.MathUtils.clamp(dz * 14, -22, 22)
      b.velocity.set(vx, 0, vz)
      b.wakeUp()
    }

    // guided turret: idly tracks the nearest obstacle so its role is obvious
    this.canShoot = this.cannonReady && this.shots > 0 && this.obstacles.length > 0 && !this.won && !this.lost
    if (this.cannonReady) {
      const idle = this.canShoot && this.missiles.length === 0 ? this.nearestObstacle(this.cannonGroup.position) : null
      const tx = idle ? idle.body.position.x : this.cannonGroup.position.x
      const slide = Math.min(1, dt * 6)
      this.cannonGroup.position.x +=
        (THREE.MathUtils.clamp(tx, -this.cannonRangeX, this.cannonRangeX) - this.cannonGroup.position.x) * slide
      this.cannonGroup.position.y = Math.sin(this.time * 2.2) * 0.035
      if (idle) {
        const dxT = idle.body.position.x - this.cannonGroup.position.x
        const dzT = idle.body.position.z - this.cannonPos.z
        const targetAngle = THREE.MathUtils.clamp(Math.atan2(dxT, -dzT), -MAX_AIM_ANGLE, MAX_AIM_ANGLE)
        this.aimAngle += (targetAngle - this.aimAngle) * Math.min(1, dt * 6)
      }
      this.cannonGroup.rotation.y = -this.aimAngle
      this.recoil = Math.max(0, this.recoil - dt * 5)
      this.barrelGroup.position.z = this.recoil * 0.26
    }

    // guided missiles
    this.updateMissiles(dt)

    // auto-spawn wave: keep the tray supplied
    if (this.autoLeft > 0 && this.time >= this.autoNextAt) {
      if (this.items.size < this.autoMax) {
        const r = this.itemRadius(this.autoTier)
        const sx = (Math.random() - 0.5) * (this.def.trayW - r * 2 - 0.6)
        const sz = (Math.random() - 0.5) * (this.def.trayD - r * 2 - 0.8)
        const item = this.makeItem(this.autoTier, sx, 3.4, sz)
        item.born = this.time
        this.fx.burst(new THREE.Vector3(sx, 2.4, sz), TIERS[this.autoTier].color, 6, 2, 1)
        this.autoLeft--
        this.autoNextAt = this.time + this.autoInterval
      } else {
        // tray full: retry shortly instead of stacking forever
        this.autoNextAt = this.time + 0.8
      }
    }

    // sync meshes + keep everything inside the tray (anti-stuck safety net)
    const halfW = this.def.trayW / 2
    const halfD = this.def.trayD / 2
    for (const item of this.items.values()) {
      const b = item.body
      // escaped the tray (tunneling / explosion fling): bring it back
      if (
        b.position.y < -2 ||
        Math.abs(b.position.x) > halfW + 0.6 ||
        b.position.z > halfD + 0.6 ||
        b.position.z < -halfD - 0.6
      ) {
        const r2 = this.itemRadius(item.tier)
        b.position.set(
          THREE.MathUtils.clamp(b.position.x, -(halfW - r2 - 0.1), halfW - r2 - 0.1),
          1.2,
          THREE.MathUtils.clamp(b.position.z, -(halfD - r2 - 0.1), halfD - r2 - 0.1)
        )
        b.velocity.set(0, 0, 0)
        b.angularVelocity.set(0, 0, 0)
        b.wakeUp()
      }
      item.mesh.position.set(b.position.x, b.position.y, b.position.z)
      item.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w)
      const t = (this.time - item.born) / 0.28
      item.mesh.scale.setScalar(t < 1 ? Math.max(0.12, easeOutBack(Math.max(0, t))) : 1)
      if (item.tier === MAX_TIER) {
        ;(item.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
          (TIERS[MAX_TIER].glow ?? 0.5) * (0.75 + 0.25 * Math.sin(this.time * 4))
      }
    }
    for (const o of this.obstacles) {
      const b = o.body
      // shoved past a wall line: pull it back inside so 'clear' goals stay solvable
      if (b.position.y < -1 || Math.abs(b.position.x) > halfW + 0.2 || b.position.z > halfD || b.position.z < -halfD - 0.4) {
        b.position.set(
          THREE.MathUtils.clamp(b.position.x, -(halfW - o.w / 2 - 0.05), halfW - o.w / 2 - 0.05),
          Math.max(b.position.y, o.h / 2 + 0.02),
          THREE.MathUtils.clamp(b.position.z, -(halfD - o.d / 2 - 0.05), halfD - o.d / 2 - 0.05)
        )
        b.velocity.set(0, 0, 0)
        b.angularVelocity.set(0, 0, 0)
        b.wakeUp()
      }
      o.mesh.position.set(b.position.x, b.position.y, b.position.z)
      o.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w)
      o.hpSprite.position.set(b.position.x, o.h + 0.55, b.position.z)
      if (o.kind === 'crystal') {
        ;(o.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.28 + 0.14 * Math.sin(this.time * 3 + o.body.id)
      }
      if (o.flash > 0) {
        o.flash = Math.max(0, o.flash - dt * 3)
        const ratio = 1 - o.hp / o.maxHp
        ;(o.mesh.material as THREE.MeshStandardMaterial).emissive.setRGB(
          0.9 * o.flash + ratio * 0.22,
          0.15 * o.flash,
          0.05 * o.flash
        )
      }
    }

    // combo expiry
    if (this.combo > 0 && this.time > this.comboUntil) {
      this.combo = 0
      this.cb.onCombo(0)
    }

    // reticle on the turret's auto-target (affordance: this can be shot)
    if (this.reticle && this.reticleMat) {
      const idle = this.canShoot && this.missiles.length === 0 ? this.nearestObstacle(this.cannonGroup.position) : null
      if (idle) {
        this.reticle.visible = true
        this.reticle.position.set(idle.body.position.x, 0, idle.body.position.z)
        const pulse = 1 + 0.12 * Math.sin(this.time * 6)
        this.reticle.scale.setScalar(pulse)
        this.reticle.rotation.y += 0.02
        this.reticleMat.opacity = 0.55 * pulse
      } else {
        this.reticle.visible = false
      }
    }

    // idle auto-hint: the game itself points out two mergeable items
    if (!this.won && !this.lost && !this.held && this.time - this.lastActionTime > 6 && this.time >= this.hintPulseNext) {
      const pair = this.closestMergePair()
      if (pair) {
        this.hintPulseNext = this.time + 0.9
        for (const it of pair) {
          this.fx.ring(new THREE.Vector3(it.body.position.x, 0, it.body.position.z), '#f59e0b', 1.35)
        }
        if (!this.hintTextShown) {
          this.hintTextShown = true
          this.fx.floatText('این دو هم‌شکل را ادغام کن!', new THREE.Vector3(0, 2.6, 0), 'big')
        }
      }
    }

    // tutorial pulses & hints (level 1)
    this.updateTutorial()

    // win / lose deferred callbacks
    if (this.won && !this.winFired && this.time - this.winAt > 1.15) {
      this.winFired = true
      this.cb.onWin(this.score)
    }
    if (this.lost && !this.loseFired && this.time - this.lostAt > 0.95) {
      this.loseFired = true
      this.cb.onLose(this.loseReason)
    }

    // periodic fail check
    this.failTimer += dt
    if (this.failTimer > 0.5) {
      this.failTimer = 0
      this.checkFail()
    }

    this.fx.update(dt)
    this.render()
  }

  /** Two closest same-tier items — used by the idle auto-hint. */
  private closestMergePair(): [MergeItem, MergeItem] | null {
    let best: [MergeItem, MergeItem] | null = null
    let bestD = Infinity
    const arr = [...this.items.values()].filter((i) => !i.consumed)
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[i].tier !== arr[j].tier) continue
        const d = arr[i].body.position.distanceTo(arr[j].body.position)
        if (d < bestD) {
          bestD = d
          best = [arr[i], arr[j]]
        }
      }
    }
    return best
  }

  /** Level-1 tutorial: pulsing rings under a same-tier pair + hints. */
  private updateTutorial() {
    // merge hint: rings under two tier-0 items until the first merge
    if (this.levelIndex === 0 && this.time < this.tPulseUntil && this.score === 0) {
      if (this.time >= this.tPulseNext) {
        this.tPulseNext = this.time + 0.8
        const two = [...this.items.values()].filter((i) => i.tier === 0).slice(0, 2)
        for (const it of two) {
          this.fx.ring(new THREE.Vector3(it.body.position.x, 0, it.body.position.z), '#ffffff', 1.5)
        }
      }
      if (!this.tMergeHintShown && this.time > 1.1) {
        this.tMergeHintShown = true
        const first = [...this.items.values()].find((i) => i.tier === 0)
        if (first) {
          this.fx.floatText(
            'دو شکل هم‌رنگ را بکش و روی هم بگذار',
            new THREE.Vector3(first.body.position.x, 2.7, first.body.position.z),
            'big'
          )
        }
      }
    }

    // shooting hint: any level with obstacles, until the first missile
    if (
      this.def.obstacles.length > 0 &&
      this.cannonReady &&
      this.shotsFired === 0 &&
      this.tShotHintCount < 3 &&
      this.time > this.tShotHintNext
    ) {
      this.tShotHintCount++
      this.tShotHintNext = this.time + 7
      const o = this.obstacles[0]
      if (o) {
        this.fx.floatText(
          'روی سد بزن تا موشک شلیک شود!',
          new THREE.Vector3(o.body.position.x, o.h + 1.6, o.body.position.z),
          'big'
        )
      }
    }
  }

  private render() {
    // camera shake
    if (this.shake > 0.002) {
      this.camera.position.set(
        this.camBase.x + (Math.random() - 0.5) * this.shake,
        this.camBase.y + (Math.random() - 0.5) * this.shake,
        this.camBase.z + (Math.random() - 0.5) * this.shake
      )
      this.shake *= 0.88
    } else {
      this.camera.position.copy(this.camBase)
    }
    this.camera.lookAt(this.camLook)
    this.renderer.render(this.scene, this.camera)
  }

  // ============================================================= public API

  setPaused(p: boolean) {
    this.paused = p
    if (!p) this.clock.getDelta()
  }

  applySettings(s: Settings) {
    this.settings = s
    audio.applySettings(s.sfx, s.music)
    if (this.renderer.shadowMap.enabled !== s.shadows) {
      this.renderer.shadowMap.enabled = s.shadows
      this.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) (mesh.material as THREE.Material).needsUpdate = true
      })
    }
  }

  applySkin(id: string) {
    this.skinId = id
  }

  grantShot() {
    this.shots++
    this.cb.onShots(this.shots)
  }

  /** Arm/disarm the bomb shot. Ignored when the player has no bombs. */
  toggleBomb(hasBomb: boolean) {
    if (this.won || this.lost) return
    if (!hasBomb) {
      audio.click()
      return
    }
    this.bombArmed = !this.bombArmed
    this.cb.onBombArmed(this.bombArmed)
    audio.click()
  }

  private buzz(pattern: number | number[]) {
    if (!this.settings.haptics) return
    try {
      navigator.vibrate?.(pattern)
    } catch {
      /* not supported */
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.rafId)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel)
    window.removeEventListener('resize', this.onResize)

    for (const item of [...this.items.values()]) this.removeItem(item)
    for (const o of [...this.obstacles]) this.removeObstacle(o)
    for (const m of this.missiles) {
      this.scene.remove(m.mesh)
      m.mesh.geometry.dispose()
      ;(m.mesh.material as THREE.Material).dispose()
    }
    this.missiles = []

    this.fx.dispose()
    for (const g of this.tierGeos) g?.dispose()
    this.obstacleGeo.dispose()
    this.woodTex.dispose()
    this.stoneTex.dispose()
    if (this.reticle) {
      this.reticle.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (mesh.isMesh) mesh.geometry.dispose()
      })
      this.reticleMat?.dispose()
    }
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.geometry.dispose()
        const mat = mesh.material as THREE.Material | THREE.Material[]
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat?.dispose?.()
      }
    })
    this.renderer.dispose()
  }
}

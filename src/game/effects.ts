/**
 * STACK & SMASH - Visual effects: particle bursts, debris chunks,
 * shockwave rings and DOM floating score texts.
 */
import * as THREE from 'three'
import { faNum } from '@/lib/format'

interface DebrisChunk {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  spin: THREE.Vector3
  life: number
  maxLife: number
}

interface RingFx {
  mesh: THREE.Mesh
  life: number
  maxLife: number
  scale: number
}

const PARTICLE_COUNT = 400

export class Effects {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private fxLayer: HTMLElement

  // particles
  private points: THREE.Points
  private pPos: Float32Array
  private pCol: Float32Array
  private pVel: Float32Array
  private pLife: Float32Array
  private pCursor = 0

  private debris: DebrisChunk[] = []
  private debrisPool: THREE.Mesh[] = []

  private rings: RingFx[] = []
  private ringPool: THREE.Mesh[] = []

  private tmpV = new THREE.Vector3()

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, fxLayer: HTMLElement) {
    this.scene = scene
    this.camera = camera
    this.fxLayer = fxLayer

    // ---- particles (THREE.Points pool)
    this.pPos = new Float32Array(PARTICLE_COUNT * 3)
    this.pCol = new Float32Array(PARTICLE_COUNT * 3)
    this.pVel = new Float32Array(PARTICLE_COUNT * 3)
    this.pLife = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) this.pPos[i * 3 + 1] = -1000

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3))
    const mat = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    this.points = new THREE.Points(geo, mat)
    this.points.frustumCulled = false
    scene.add(this.points)

    // ---- shared geometries for debris & rings
    const debrisGeo = new THREE.BoxGeometry(0.17, 0.17, 0.17)
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(
        debrisGeo,
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, transparent: true })
      )
      m.visible = false
      m.castShadow = false
      scene.add(m)
      this.debrisPool.push(m)
    }

    const ringGeo = new THREE.RingGeometry(0.82, 1.0, 40)
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      )
      m.rotation.x = -Math.PI / 2
      m.visible = false
      scene.add(m)
      this.ringPool.push(m)
    }
  }

  /** Spawn a colorful particle burst. */
  burst(pos: THREE.Vector3, colorHex: string, count = 22, speed = 4.5, upBias = 2.2) {
    const color = new THREE.Color(colorHex)
    for (let i = 0; i < count; i++) {
      const idx = this.pCursor
      this.pCursor = (this.pCursor + 1) % PARTICLE_COUNT
      const o = idx * 3
      this.pPos[o] = pos.x
      this.pPos[o + 1] = pos.y
      this.pPos[o + 2] = pos.z
      const dir = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() * 0.9 + 0.15,
        Math.random() - 0.5
      ).normalize()
      const s = speed * (0.4 + Math.random() * 0.8)
      this.pVel[o] = dir.x * s
      this.pVel[o + 1] = dir.y * s + upBias
      this.pVel[o + 2] = dir.z * s
      const tint = 0.75 + Math.random() * 0.25
      this.pCol[o] = color.r * tint
      this.pCol[o + 1] = color.g * tint
      this.pCol[o + 2] = color.b * tint
      this.pLife[idx] = 0.55 + Math.random() * 0.45
    }
  }

  /** Expanding flat ring on the floor. */
  ring(pos: THREE.Vector3, colorHex = '#ffffff', scale = 2.4) {
    const mesh = this.ringPool.find((m) => !m.visible)
    if (!mesh) return
    ;(mesh.material as THREE.MeshBasicMaterial).color.set(colorHex)
    ;(mesh.material as THREE.MeshBasicMaterial).opacity = 0.85
    mesh.position.set(pos.x, 0.06, pos.z)
    mesh.scale.setScalar(0.3)
    mesh.visible = true
    this.rings.push({ mesh, life: 0.55, maxLife: 0.55, scale })
  }

  /** Small physical-looking debris chunks (purely decorative). */
  debrisBurst(pos: THREE.Vector3, colorHex: string, count = 7) {
    const color = new THREE.Color(colorHex)
    for (let i = 0; i < count; i++) {
      const mesh = this.debrisPool.find((m) => !m.visible)
      if (!mesh) return
      mesh.position.copy(pos)
      mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone()
      ;(mesh.material as THREE.MeshStandardMaterial).color.copy(color)
      ;(mesh.material as THREE.MeshStandardMaterial).transparent = true
      ;(mesh.material as THREE.MeshStandardMaterial).opacity = 1
      mesh.visible = true
      const s = 0.6 + Math.random() * 0.7
      mesh.scale.setScalar(0.7 + Math.random() * 0.9)
      this.debris.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 6 * s, Math.random() * 5 + 2, (Math.random() - 0.5) * 6 * s),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: 0.9,
        maxLife: 0.9,
      })
    }
  }

  /** Floating DOM text (score, combo...) projected from a 3D position. */
  floatText(text: string, worldPos: THREE.Vector3, variant: 'score' | 'combo' | 'big' = 'score') {
    this.tmpV.copy(worldPos)
    this.tmpV.project(this.camera)
    const w = this.fxLayer.clientWidth
    const h = this.fxLayer.clientHeight
    if (this.tmpV.z > 1) return
    const x = (this.tmpV.x * 0.5 + 0.5) * w
    const y = (-this.tmpV.y * 0.5 + 0.5) * h
    const el = document.createElement('span')
    el.className = `fx-floaty fx-${variant}`
    el.textContent = text
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    this.fxLayer.appendChild(el)
    window.setTimeout(() => el.remove(), 1100)
  }

  update(dt: number) {
    // particles
    let dirty = false
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (this.pLife[i] <= 0) continue
      dirty = true
      this.pLife[i] -= dt
      const o = i * 3
      if (this.pLife[i] <= 0) {
        this.pPos[o + 1] = -1000
        continue
      }
      this.pVel[o + 1] -= 9 * dt
      this.pPos[o] += this.pVel[o] * dt
      this.pPos[o + 1] += this.pVel[o + 1] * dt
      this.pPos[o + 2] += this.pVel[o + 2] * dt
      if (this.pPos[o + 1] < 0.05) {
        this.pPos[o + 1] = 0.05
        this.pVel[o + 1] *= -0.4
        this.pVel[o] *= 0.8
        this.pVel[o + 2] *= 0.8
      }
    }
    if (dirty) (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true

    // debris
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i]
      d.life -= dt
      if (d.life <= 0) {
        d.mesh.visible = false
        ;(d.mesh.material as THREE.MeshStandardMaterial).dispose()
        this.debris.splice(i, 1)
        continue
      }
      d.vel.y -= 14 * dt
      d.mesh.position.addScaledVector(d.vel, dt)
      if (d.mesh.position.y < 0.09) {
        d.mesh.position.y = 0.09
        d.vel.y *= -0.45
        d.vel.x *= 0.75
        d.vel.z *= 0.75
      }
      d.mesh.rotation.x += d.spin.x * dt
      d.mesh.rotation.y += d.spin.y * dt
      const m = d.mesh.material as THREE.MeshStandardMaterial
      m.opacity = Math.min(1, d.life / (d.maxLife * 0.5))
    }

    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]
      r.life -= dt
      if (r.life <= 0) {
        r.mesh.visible = false
        this.rings.splice(i, 1)
        continue
      }
      const t = 1 - r.life / r.maxLife
      const target = r.scale * (0.3 + t * 0.9)
      r.mesh.scale.setScalar(target)
      ;(r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t)
    }
  }

  dispose() {
    this.scene.remove(this.points)
    this.points.geometry.dispose()
    ;(this.points.material as THREE.Material).dispose()
    for (const d of this.debris) {
      d.mesh.visible = false
      ;(d.mesh.material as THREE.Material).dispose()
    }
    this.debris = []
    for (const m of this.debrisPool) {
      this.scene.remove(m)
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    }
    for (const r of this.rings) r.mesh.visible = false
    this.rings = []
    for (const m of this.ringPool) {
      this.scene.remove(m)
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    }
    this.fxLayer.querySelectorAll('.fx-floaty').forEach((el) => el.remove())
  }
}

/** Convenience: formatted Persian score text. */
export function scoreText(n: number): string {
  return `+${faNum(n)}`
}

import * as THREE from 'three'

export type PulseConfig = {
  lubDuration: number
  dubDuration: number
  idleAmplitude: number
}

export class PulseController {
  private active = false
  private startTime = 0
  private intensity = 1
  private baseScale: THREE.Vector3
  private config: PulseConfig

  constructor(baseScale: THREE.Vector3, config?: Partial<PulseConfig>) {
    this.baseScale = baseScale.clone()
    this.config = {
      lubDuration: 0.15,
      dubDuration: 0.25,
      idleAmplitude: 0.015,
      ...config,
    }
  }

  trigger(nowSeconds: number, intensity = 1) {
    this.active = true
    this.startTime = nowSeconds
    this.intensity = intensity
  }

  update(object: THREE.Object3D, nowSeconds: number) {
    const { lubDuration, dubDuration, idleAmplitude } = this.config
    const totalDuration = lubDuration + dubDuration
    const elapsed = nowSeconds - this.startTime

    if (this.active && elapsed <= totalDuration) {
      if (elapsed <= lubDuration) {
        const p = elapsed / lubDuration
        const inflate = 1 + 0.25 * Math.sin(Math.PI * p) * this.intensity
        object.scale.set(
          this.baseScale.x * inflate * 1.06,
          this.baseScale.y * inflate * 0.98,
          this.baseScale.z * inflate * 1.06,
        )
        object.rotation.y = 0.05 * Math.sin(Math.PI * p) * this.intensity
      } else {
        const p = (elapsed - lubDuration) / dubDuration
        const deflate = 1 - 0.05 * Math.sin(Math.PI * p) * this.intensity
        object.scale.set(
          this.baseScale.x * deflate * 1.02,
          this.baseScale.y * deflate * 0.99,
          this.baseScale.z * deflate * 1.02,
        )
        object.rotation.y = 0.02 * Math.sin(Math.PI * p) * this.intensity
      }
    } else if (this.active && elapsed > totalDuration) {
      this.active = false
      object.scale.copy(this.baseScale)
      object.rotation.y = 0
    } else {
      const idle = 1 + idleAmplitude * Math.sin(nowSeconds * 1.5)
      object.scale.lerp(
        new THREE.Vector3(
          this.baseScale.x * idle * 1.02,
          this.baseScale.y * idle * 0.99,
          this.baseScale.z * idle * 1.02,
        ),
        0.08,
      )
      object.rotation.y = 0.006 * Math.sin(nowSeconds * 1.5)
    }
  }

  // Returns a 0..1 factor representing current pulse strength for driving FX
  getPulseFactor(nowSeconds: number): number {
    const { lubDuration, dubDuration } = this.config
    const total = lubDuration + dubDuration
    const elapsed = nowSeconds - this.startTime
    if (!this.active) return 0
    if (elapsed <= lubDuration) {
      const p = elapsed / lubDuration
      return Math.sin(Math.PI * p) * this.intensity
    }
    if (elapsed <= total) {
      const p = (elapsed - lubDuration) / dubDuration
      return Math.sin(Math.PI * p) * this.intensity * 0.5
    }
    return 0
  }
}

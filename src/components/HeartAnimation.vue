<template>
  <div class="three-heart-wrap rounded-sm">
    <div ref="container" class="three-heart-container" />
    <!-- <div class="three-heart-debug">
      <div>
        <strong>Pivot rot (deg)</strong>: X {{ pivotDeg.x.toFixed(1) }}, Y
        {{ pivotDeg.y.toFixed(1) }}, Z {{ pivotDeg.z.toFixed(1) }}
      </div>
      <div>
        <strong>Heart rot (deg)</strong>: X {{ heartDeg.x.toFixed(1) }}, Y
        {{ heartDeg.y.toFixed(1) }}, Z {{ heartDeg.z.toFixed(1) }}
      </div>
      <div>
        <strong>Camera pos</strong>: X {{ camPos.x.toFixed(2) }}, Y {{ camPos.y.toFixed(2) }}, Z
        {{ camPos.z.toFixed(2) }}
      </div>
      <div>
        <strong>Camera target</strong>: X {{ camTarget.x.toFixed(2) }}, Y
        {{ camTarget.y.toFixed(2) }}, Z {{ camTarget.z.toFixed(2) }}
      </div>
    </div> -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { createThreeCore } from '@/three/setup'
import { loadHeartModel } from '@/three/heartLoader'
import { PulseController } from '@/three/pulse'
import { createToonMaterialFactory } from '@/three/materials'
import { addOutlinePass } from '@/three/outline'

const props = defineProps({
  beat: { type: Number, default: 0 },
  bpm: { type: Number, default: 70 },
  modelUrl: { type: String, default: '/models/heart.glb' },
  pixelRatio: { type: Number, default: window.devicePixelRatio || 1 },
})

const container = ref<HTMLElement | null>(null)
const pivotDeg = ref({ x: 0, y: 0, z: 0 })
const heartDeg = ref({ x: 0, y: 0, z: 0 })
const camPos = ref({ x: 0, y: 0, z: 0 })
const camTarget = ref({ x: 0, y: 0, z: 0 })

let core: ReturnType<typeof createThreeCore> | null = null
let heartGroup: THREE.Group | null = null
let pivotGroup: THREE.Group | null = null
let animationFrameId: number | null = null
let lastBeatPropValue = props.beat
let pulse: PulseController | null = null
let lastAutoPulse = 0
let outlinePass: { edgeStrength: number; edgeThickness: number } | null = null

onMounted(async () => {
  if (!container.value) return
  core = createThreeCore({
    container: container.value,
    pixelRatio: props.pixelRatio,
    background: new THREE.Color(0x2e4fbf),
  })
  const toonFactory = createToonMaterialFactory({ color: 0xff4f7a, gradientStops: 4 })
  const { group, baseScale } = await loadHeartModel({
    url: props.modelUrl,
    materialFactory: toonFactory,
  })
  heartGroup = group
  pivotGroup = new THREE.Group()
  pivotGroup.add(group)
  // Rotate 180° around Y to see the opposite side, without changing position
  pivotGroup.rotateY(30)

  pulse = new PulseController(baseScale)
  core.scene.add(pivotGroup)
  outlinePass = addOutlinePass(core.composer, core.scene, core.camera, [group], {
    edgeStrength: 2.0,
    edgeThickness: 0.4,
    edgeGlow: 0,
    visibleEdgeColor: 0x64d8bf,
    hiddenEdgeColor: 0x64d8bf,
  })
  startLoop()
})

onBeforeUnmount(() => {
  stopLoop()
  if (core) core.dispose()
})

watch(
  () => props.beat,
  (newVal) => {
    if (newVal === lastBeatPropValue) return
    lastBeatPropValue = newVal
    if (pulse && core) pulse.trigger(core.clock.getElapsedTime(), 1.0)
  },
)

function startLoop() {
  if (!core) return

  const onResize = () => core && core.handleResize()
  window.addEventListener('resize', onResize)
  onResize()

  const loop = () => {
    const dt = core!.clock.getDelta()
    const t = core!.clock.getElapsedTime()

    const interval = 60 / Math.max(30, props.bpm)
    if (t - lastAutoPulse > interval) {
      lastAutoPulse = t
      if (pulse) pulse.trigger(t, 0.9)
    }

    if (heartGroup && pulse) {
      pulse.update(heartGroup, t)
      if (outlinePass) {
        const f = pulse.getPulseFactor(t)
        outlinePass.edgeStrength = 1.0 + f * 2.0
        outlinePass.edgeThickness = 0.2 + f * 0.5
      }
    }

    if (pivotGroup) {
      pivotDeg.value = {
        x: (pivotGroup.rotation.x * 180) / Math.PI,
        y: (pivotGroup.rotation.y * 180) / Math.PI,
        z: (pivotGroup.rotation.z * 180) / Math.PI,
      }
    }
    if (heartGroup) {
      heartDeg.value = {
        x: (heartGroup.rotation.x * 180) / Math.PI,
        y: (heartGroup.rotation.y * 180) / Math.PI,
        z: (heartGroup.rotation.z * 180) / Math.PI,
      }
    }
    camPos.value = {
      x: core!.camera.position.x,
      y: core!.camera.position.y,
      z: core!.camera.position.z,
    }
    camTarget.value = {
      x: core!.controls.target.x,
      y: core!.controls.target.y,
      z: core!.controls.target.z,
    }

    core!.controls.update()
    core!.composer.render(dt)
    animationFrameId = requestAnimationFrame(loop)
  }

  animationFrameId = requestAnimationFrame(loop)
}

function stopLoop() {
  if (animationFrameId != null) cancelAnimationFrame(animationFrameId)
  animationFrameId = null
}
</script>

<style scoped>
.three-heart-container {
  width: 160px;
  height: 160px;
  background: transparent;
  user-select: none;
}
.three-heart-wrap {
  position: relative;
  width: fit-content;
  background: transparent;
}
.three-heart-debug {
  position: absolute;
  right: 6px;
  top: 6px;
  background: transparent;
  color: #fff;

  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 6px;
  line-height: 1.3;
}
</style>

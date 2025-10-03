<template>
  <div
    ref="container"
    style="width: 100%; height: 240px; overflow: hidden; background: transparent"
  ></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'
import { PulseController } from '@/three/pulse'

const props = defineProps({
  data: { type: Array, required: true },
  color: { type: String, default: '#00e5ff' },
  background: { type: String, default: 'transparent' },
  beat: { type: Number, default: 0 },
  bpm: { type: Number, default: 70 },
  baseThickness: { type: Number, default: 0.5 },
  pulseThickness: { type: Number, default: 3.0 },
})

const container = ref<HTMLElement | null>(null)
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.OrthographicCamera | null = null
let grid: THREE.Group | null = null
let lineMesh: {
  mainMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  glowMesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
} | null = null
let animationId: number | null = null
let width = 0
let height = 0

const CAPACITY = 1024
let LINE_THICKNESS = props.baseThickness

const pulse = new PulseController(new THREE.Vector3(1, 1, 1))
let lastBeat = props.beat
let globalTime = 0

// Dynamic color palette based on props.color
let palette: THREE.Color[] = []

function hexToHSL(hex: string) {
  const color = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  return hsl
}

function hslToColor(h: number, s: number, l: number) {
  return new THREE.Color().setHSL(h, s, l)
}

function generatePalette(baseColor: string) {
  const hsl = hexToHSL(baseColor)
  palette = [
    hslToColor((hsl.h - 0.0417) % 1, hsl.s * 0.9, hsl.l * 0.95),
    hslToColor(hsl.h, hsl.s, hsl.l),
    hslToColor((hsl.h + 0.0417) % 1, hsl.s * 0.9, hsl.l * 1.05),
  ]
}

function lerpColors(a: THREE.Color, b: THREE.Color, t: number) {
  return a.clone().lerp(b, t)
}

function getColorAt(t: number) {
  t = t % 1
  const n = palette.length
  const scaledT = t * (n - 1)
  const index1 = Math.floor(scaledT)
  const index2 = Math.min(index1 + 1, n - 1)
  const localT = scaledT - index1
  return lerpColors(palette[index1], palette[index2], localT)
}

function createGrid() {
  const gridGroup = new THREE.Group()
  const gridColor = new THREE.Color('#ffffff')
  const material = new THREE.LineBasicMaterial({
    color: gridColor,
    transparent: true,
    opacity: 0.1,
    linewidth: 1,
  })
  const lines = new THREE.Group()
  const ySpan = 12
  for (let y = -ySpan; y <= ySpan; y += 4) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width / 20, y, 0),
      new THREE.Vector3(width / 20, y, 0),
    ])
    const l = new THREE.Line(geo, material)
    lines.add(l)
  }

  return gridGroup
}

function createWaveLine() {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(CAPACITY * 2 * 3)
  const indices = new Uint32Array(CAPACITY * 2 * 3)
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.setDrawRange(0, 0)

  const mainMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(props.color),
    side: THREE.DoubleSide,
    transparent: false,
  })

  const glowColor = new THREE.Color(props.color).offsetHSL(0.05, 0.2, 0.3)
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: glowColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.5,
  })

  const mainMesh = new THREE.Mesh(geometry.clone(), mainMaterial)
  const glowMesh = new THREE.Mesh(geometry.clone(), glowMaterial)

  return { mainMesh, glowMesh }
}

function resizeRenderer() {
  if (!container.value || !renderer || !camera) return
  width = container.value.clientWidth
  height = container.value.clientHeight
  renderer.setSize(width, height)
  camera.left = -width / 20
  camera.right = width / 20
  camera.top = height / 20
  camera.bottom = -height / 20
  camera.updateProjectionMatrix()

  if (grid && scene) {
    scene.remove(grid)
    grid.traverse((obj: any) => {
      if (obj.isLine) {
        obj.geometry.dispose()
        obj.material.dispose()
      }
    })
    grid = createGrid()
    scene.add(grid)
  }
}

function computeRange(arr: number[]) {
  let min = Infinity,
    max = -Infinity
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: -1, max: 1 }
  if (min === max) {
    const pad = Math.abs(min) * 0.1 + 1
    return { min: min - pad, max: max + pad }
  }
  const pad = (max - min) * 0.15
  return { min: min - pad, max: max + pad }
}

function updateLine() {
  if (!lineMesh || !lineMesh.mainMesh || !lineMesh.glowMesh) {
    console.warn('Line mesh not initialized')
    return
  }
  const src: any = props.data || []
  if (!src.length) {
    console.warn('No data provided for rendering')
    return
  }

  const mainPos = lineMesh.mainMesh.geometry.attributes.position.array as Float32Array
  const glowPos = lineMesh.glowMesh.geometry.attributes.position.array as Float32Array
  const indices = lineMesh.mainMesh.geometry.index!.array as Uint32Array
  const xSpan = width / 10

  function buildRibbon(
    samples: number,
    startIdx: number,
    isRingBuffer: boolean,
    pos: Float32Array,
    thickness: number,
  ) {
    const { min, max } = computeRange(src)
    const yScale = 12 / (max - min || 1)

    const points: THREE.Vector3[] = []
    for (let i = 0; i < samples; i++) {
      const t = i / Math.max(1, samples - 1)
      const x = -xSpan / 2 + t * xSpan
      const v = isRingBuffer ? src[(startIdx + i) % samples] : src[i]
      const y = Number.isFinite(v) ? (v - min) * yScale - 2 : -2
      points.push(new THREE.Vector3(x, y, 0))
    }

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)
    const curvePoints = curve.getPoints(samples * 2)

    const normals: THREE.Vector3[] = []
    for (let i = 0; i < curvePoints.length; i++) {
      const prev = i === 0 ? curvePoints[0] : curvePoints[i - 1]
      const curr = curvePoints[i]
      const next = i === curvePoints.length - 1 ? curr : curvePoints[i + 1]
      const tangent = next.clone().sub(prev).normalize()
      const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize()
      normals.push(normal)
    }

    for (let i = 0; i < curvePoints.length; i++) {
      const p = curvePoints[i]
      const n = normals[i]
      const halfThick = thickness / 2
      pos[i * 6 + 0] = p.x + n.x * halfThick
      pos[i * 6 + 1] = p.y + n.y * halfThick
      pos[i * 6 + 2] = p.z
      pos[i * 6 + 3] = p.x - n.x * halfThick
      pos[i * 6 + 4] = p.y - n.y * halfThick
      pos[i * 6 + 5] = p.z
    }

    for (let i = 0; i < curvePoints.length - 1; i++) {
      const i0 = i * 2
      const i1 = i0 + 1
      const i2 = i0 + 2
      const i3 = i0 + 3
      indices[i * 6 + 0] = i0
      indices[i * 6 + 1] = i1
      indices[i * 6 + 2] = i2
      indices[i * 6 + 3] = i1
      indices[i * 6 + 4] = i3
      indices[i * 6 + 5] = i2
    }

    return curvePoints
  }

  if (src && src._rbFull === true && typeof src._rbIndex === 'number') {
    const samples = Math.min(src.length, CAPACITY)
    const startIdx = src._rbIndex % samples
    const mainCurvePoints = buildRibbon(samples, startIdx, true, mainPos, LINE_THICKNESS)
    const glowCurvePoints = buildRibbon(samples, startIdx, true, glowPos, LINE_THICKNESS * 1.2)
    lineMesh.mainMesh.geometry.setDrawRange(0, (mainCurvePoints.length - 1) * 6)
    lineMesh.glowMesh.geometry.setDrawRange(0, (glowCurvePoints.length - 1) * 6)
  } else {
    const all: number[] = src
    const count = Math.min(all.length, CAPACITY)
    const start = Math.max(0, all.length - count)
    const data = all.slice(start)
    const samples = Math.max(2, data.length)
    const mainCurvePoints = buildRibbon(samples, 0, false, mainPos, LINE_THICKNESS)
    const glowCurvePoints = buildRibbon(samples, 0, false, glowPos, LINE_THICKNESS * 1.2)
    lineMesh.mainMesh.geometry.setDrawRange(0, (mainCurvePoints.length - 1) * 6)
    lineMesh.glowMesh.geometry.setDrawRange(0, (glowCurvePoints.length - 1) * 6)
  }

  lineMesh.mainMesh.geometry.attributes.position.needsUpdate = true
  lineMesh.glowMesh.geometry.attributes.position.needsUpdate = true
  lineMesh.mainMesh.geometry.index!.needsUpdate = true
  lineMesh.glowMesh.geometry.index!.needsUpdate = true
}

function animate() {
  if (!renderer || !scene || !camera || !lineMesh) {
    console.warn('Renderer, scene, camera, or lineMesh not initialized')
    return
  }

  globalTime += 0.01
  const t = performance.now() / 1000
  const interval = 60 / Math.max(30, props.bpm)

  if ((pulse as any)._active === false && t % interval < 0.016) {
    pulse.trigger(t, 1)
  }

  const f = pulse.getPulseFactor(t)
  LINE_THICKNESS = props.baseThickness + f * props.pulseThickness

  const glowDelay = 0.1
  const glowF = pulse.getPulseFactor(t - glowDelay)
  const glowOpacity = glowF * 0.5

  if (lineMesh) {
    const color = getColorAt(globalTime * 0.1)
    lineMesh.mainMesh.material.color = color
    lineMesh.glowMesh.material.opacity = glowOpacity
  }

  updateLine()
  renderer.render(scene, camera)
  animationId = requestAnimationFrame(animate)
}

onMounted(() => {
  if (!container.value) {
    console.error('Container not found')
    return
  }

  generatePalette(props.color)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0) // Ensure transparent background

  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.set(0, 0, 10)
  camera.lookAt(0, 0, 0)

  grid = createGrid()
  scene.add(grid)

  lineMesh = createWaveLine()
  scene.add(lineMesh.mainMesh)
  scene.add(lineMesh.glowMesh)

  container.value.appendChild(renderer.domElement)
  resizeRenderer()
  window.addEventListener('resize', resizeRenderer)

  console.log('Renderer initialized, starting animation')
  animate()
})

onBeforeUnmount(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  window.removeEventListener('resize', resizeRenderer)
  if (renderer) {
    renderer.dispose()
    renderer = null
  }
  if (lineMesh) {
    lineMesh.mainMesh.geometry.dispose()
    lineMesh.mainMesh.material.dispose()
    lineMesh.glowMesh.geometry.dispose()
    lineMesh.glowMesh.material.dispose()
    lineMesh = null
  }
  if (grid && scene) {
    scene.remove(grid)
    grid.traverse((obj: any) => {
      if (obj.isLine) {
        obj.geometry.dispose()
        obj.material.dispose()
      }
    })
    grid = null
  }
  scene = null
  camera = null
})

watch(
  () => props.color,
  (newColor) => {
    generatePalette(newColor)
    if (lineMesh) {
      lineMesh.mainMesh.material.color = new THREE.Color(newColor)
      const glowColor = new THREE.Color(newColor).offsetHSL(0.05, 0.2, 0.3)
      lineMesh.glowMesh.material.color = glowColor
    }
  },
)

watch(
  () => props.beat,
  (newBeat) => {
    if (newBeat === lastBeat) return
    lastBeat = newBeat as number
    const t = performance.now() / 1000
    pulse.trigger(t, 1)
  },
)
</script>

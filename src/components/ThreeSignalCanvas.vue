<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  data: { type: Array, required: true },
  color: { type: String, default: '#00e5ff' },
  background: { type: String, default: '#0b1020' },
})

const container = ref(null)
let renderer, scene, camera, grid, line, glow, animationId
let width = 0,
  height = 0
const CAPACITY = 1024

function createGrid() {
  const gridGroup = new THREE.Group()
  const gridColor = new THREE.Color('#1b2a4a')
  const material = new THREE.LineBasicMaterial({
    color: gridColor,
    transparent: true,
    opacity: 0.35,
  })

  const lines = new THREE.Group()
  const depth = 80
  const spacing = 4
  for (let z = -depth; z <= 0; z += spacing) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-50, -10, z),
      new THREE.Vector3(50, -10, z),
    ])
    const l = new THREE.Line(geo, material)
    lines.add(l)
  }
  for (let x = -50; x <= 50; x += spacing) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, -10, -depth),
      new THREE.Vector3(x, -10, 0),
    ])
    const l = new THREE.Line(geo, material)
    lines.add(l)
  }
  gridGroup.add(lines)

  const gradient = new THREE.PlaneGeometry(120, 60)
  const gradMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(props.background),
    transparent: true,
    opacity: 0.9,
  })
  const plane = new THREE.Mesh(gradient, gradMat)
  plane.position.set(0, -10, -20)
  plane.rotation.x = -Math.PI * 0.5
  gridGroup.add(plane)

  return gridGroup
}

function createWaveLine() {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(CAPACITY * 3)
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setDrawRange(0, 0)
  const material = new THREE.LineBasicMaterial({ color: new THREE.Color(props.color) })
  return new THREE.Line(geometry, material)
}

function createGlow() {
  const glowGeo = new THREE.PlaneGeometry(120, 40)
  const glowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(props.color),
    transparent: true,
    opacity: 0.08,
  })
  const mesh = new THREE.Mesh(glowGeo, glowMat)
  mesh.position.set(0, 0, -5)
  return mesh
}

function resizeRenderer() {
  if (!container.value) return
  width = container.value.clientWidth
  height = container.value.clientHeight
  renderer.setSize(width, height)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

function computeRange(arr) {
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
  if (!line) return
  const src = props.data || []
  const pos = line.geometry.attributes.position.array
  const xSpan = 100

  // Ring buffer path: chronological read without allocations
  if (src && src._rbFull === true && typeof src._rbIndex === 'number') {
    const samples = Math.min(src.length, CAPACITY)
    const startIdx = src._rbIndex % samples

    // Compute range in one pass
    let min = Infinity,
      max = -Infinity
    for (let i = 0; i < samples; i++) {
      const v = src[(startIdx + i) % samples]
      if (!Number.isFinite(v)) continue
      if (v < min) min = v
      if (v > max) max = v
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = -1
      max = 1
    }
    const yScale = 12 / (max - min || 1)

    const denom = Math.max(1, samples - 1)
    for (let i = 0; i < samples; i++) {
      const t = i / denom
      const x = -xSpan / 2 + t * xSpan
      const v = src[(startIdx + i) % samples]
      const y = Number.isFinite(v) ? (v - min) * yScale - 2 : -2
      pos[i * 3 + 0] = x
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = 0
    }

    line.geometry.setDrawRange(0, samples)
    line.geometry.attributes.position.needsUpdate = true
    return
  }

  // Fallback for normal growing arrays (initial fill before ring buffer is full)
  const all = src
  const count = Math.min(all.length, CAPACITY)
  const start = Math.max(0, all.length - count)
  const data = all.slice(start)

  // Compute range
  let min = Infinity,
    max = -Infinity
  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (!Number.isFinite(v)) continue
    if (v < min) min = v
    if (v > max) max = v
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = -1
    max = 1
  }
  const yScale = 12 / (max - min || 1)

  const samples = Math.max(2, data.length)
  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1)
    const x = -xSpan / 2 + t * xSpan
    const v = data[i]
    const y = Number.isFinite(v) ? (v - min) * yScale - 2 : -2
    pos[i * 3 + 0] = x
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = 0
  }
  line.geometry.setDrawRange(0, samples)
  line.geometry.attributes.position.needsUpdate = true
}

function animate() {
  updateLine()
  grid.rotation.z = Math.sin(performance.now() * 0.0002) * 0.02
  glow.material.opacity = 0.06 + 0.02 * (0.5 + 0.5 * Math.sin(performance.now() * 0.003))
  renderer.render(scene, camera)
  animationId = requestAnimationFrame(animate)
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setClearColor(new THREE.Color(props.background), 1)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
  camera.position.set(0, 8, 30)
  camera.lookAt(0, 0, 0)

  grid = createGrid()
  scene.add(grid)

  line = createWaveLine()
  scene.add(line)

  glow = createGlow()
  scene.add(glow)

  container.value.appendChild(renderer.domElement)
  resizeRenderer()
  window.addEventListener('resize', resizeRenderer)

  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resizeRenderer)
  if (renderer) {
    renderer.dispose()
  }
  if (line) line.geometry.dispose()
})

watch(
  () => props.color,
  (c) => {
    if (line) line.material.color = new THREE.Color(c)
    if (glow) glow.material.color = new THREE.Color(c)
  },
)
</script>

<template>
  <div
    ref="container"
    style="
      width: 100%;
      height: 460px;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
    "
  ></div>
</template>

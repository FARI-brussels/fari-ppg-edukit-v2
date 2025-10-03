<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

const container = ref<HTMLDivElement | null>(null)

const CAPACITY = 1024
const LINE_THICKNESS = 60
const LINE_COUNT = 2
const LINE_SPACING = 10 // vertical space between lines

let renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.OrthographicCamera,
  lineMeshes: THREE.Mesh[] = [],
  animationId: number,
  width = 0,
  height = 0,
  globalTime = 0

const palette = [
  new THREE.Color('#183E91'),
  new THREE.Color('#2E4FBF'),
  new THREE.Color('#4393DE'),
  new THREE.Color('#64D8BF'),
  new THREE.Color('#F9DB6B'),
  new THREE.Color('#B93080'),
]

function lerpColors(a: THREE.Color, b: THREE.Color, t: number) {
  return a.clone().lerp(b, t)
}

function getColorAt(t: number) {
  t = t % 1
  const n = palette.length
  const scaledT = t * n
  const index1 = Math.floor(scaledT) % n
  const index2 = (index1 + 1) % n
  const localT = scaledT - Math.floor(scaledT)
  return lerpColors(palette[index1], palette[index2], localT)
}

function createWaveLine() {
  const geometry = new THREE.BufferGeometry()

  const positions = new Float32Array(CAPACITY * 2 * 3)
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const colors = new Float32Array(CAPACITY * 2 * 3)
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const indices = new Uint32Array((CAPACITY * 2 - 2) * 3)
  for (let i = 0; i < CAPACITY * 2 - 2; i += 2) {
    const idx = (i / 2) * 6
    indices[idx + 0] = i
    indices[idx + 1] = i + 1
    indices[idx + 2] = i + 2

    indices[idx + 3] = i + 1
    indices[idx + 4] = i + 3
    indices[idx + 5] = i + 2
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.setDrawRange(0, indices.length)

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: false,
  })

  return new THREE.Mesh(geometry, material)
}

// Waveform function with time parameter to animate horizontally
function heartbeatWaveform(x: number, t: number) {
  const pulseSpeed = 0.1
  const pulseWidth = 0.1

  // Pulse position continuously increases (no modulo)
  const pulsePos = t * pulseSpeed

  // Circular distance between x and pulsePos mod 1
  function circularDistance(a: number, b: number) {
    const diff = Math.abs((a % 1) - (b % 1))
    return Math.min(diff, 1 - diff)
  }

  const dist = circularDistance(x, pulsePos)
  const envelope = Math.exp(-(dist * dist) / (2 * pulseWidth * pulseWidth))

  return Math.sin(x * Math.PI * 10) * envelope * 4 + Math.sin(x * Math.PI * 2) * 0.8
}

function updateLine(lineMesh: THREE.Mesh, lineIndex: number, lineTime: number) {
  const pos = lineMesh.geometry.attributes.position.array as Float32Array
  const colors = lineMesh.geometry.attributes.color.array as Float32Array

  const halfThick = LINE_THICKNESS / 2

  // Calculate vertical offset to stack lines nicely, centered vertically
  const totalHeight = (LINE_COUNT - 1) * LINE_SPACING
  const yOffset = totalHeight / 2 - lineIndex * LINE_SPACING

  for (let i = 0; i < CAPACITY; i++) {
    const t = i / (CAPACITY - 1)
    const x = -width / 2 + t * width

    const yCenter = heartbeatWaveform(t, lineTime) * (height / 10)

    // Approximate tangent for normal vector
    const delta = 1 / CAPACITY
    const yBefore = heartbeatWaveform(Math.max(t - delta, 0), lineTime) * (height / 10)
    const yAfter = heartbeatWaveform(Math.min(t + delta, 1), lineTime) * (height / 10)
    const tangent = new THREE.Vector2(width * delta, yAfter - yBefore).normalize()
    const normal = new THREE.Vector2(-tangent.y, tangent.x)

    const leftX = x + normal.x * halfThick
    const leftY = yCenter + normal.y * halfThick + yOffset
    const rightX = x - normal.x * halfThick
    const rightY = yCenter - normal.y * halfThick + yOffset

    pos[i * 6 + 0] = leftX
    pos[i * 6 + 1] = leftY
    pos[i * 6 + 2] = 0

    pos[i * 6 + 3] = rightX
    pos[i * 6 + 4] = rightY
    pos[i * 6 + 5] = 0

    const colorT = (t + lineTime * 0.1) % 1
    const color = getColorAt(colorT)

    colors[i * 6 + 0] = color.r
    colors[i * 6 + 1] = color.g
    colors[i * 6 + 2] = color.b

    colors[i * 6 + 3] = color.r
    colors[i * 6 + 4] = color.g
    colors[i * 6 + 5] = color.b
  }

  lineMesh.geometry.attributes.position.needsUpdate = true
  lineMesh.geometry.attributes.color.needsUpdate = true
}

function animate() {
  globalTime += 0.01

  // Define different speed multipliers for each line
  const speeds = [1, 1.4, 0.7]

  for (let i = 0; i < LINE_COUNT; i++) {
    updateLine(lineMeshes[i], i, globalTime * speeds[i])
  }

  renderer.render(scene, camera)
  animationId = requestAnimationFrame(animate)
}

function resizeRenderer() {
  if (!container.value) return
  width = container.value.clientWidth
  height = container.value.clientHeight

  renderer.setSize(width, height)

  const padding = 80 // Add vertical padding (increase if needed)

  camera.left = -width / 2
  camera.right = width / 2
  camera.top = height / 2 + padding
  camera.bottom = -height / 2 - padding
  camera.updateProjectionMatrix()
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  scene = new THREE.Scene()

  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.set(0, 0, 10)
  camera.lookAt(0, 0, 0)

  // Create and add multiple lines
  for (let i = 0; i < LINE_COUNT; i++) {
    const mesh = createWaveLine()
    scene.add(mesh)
    lineMeshes.push(mesh)
  }

  container.value?.appendChild(renderer.domElement)

  resizeRenderer()
  window.addEventListener('resize', resizeRenderer)

  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resizeRenderer)

  renderer.dispose()
  lineMeshes.forEach((mesh) => {
    mesh.geometry.dispose()
    mesh.material.dispose()
  })
})
</script>

<template>
  <div
    ref="container"
    style="
      width: 110%;
      height: 600px;
      overflow: hidden;
      background: transparent;
      position: absolute;
      top: 150px;
      left: -100px;
    "
  ></div>
</template>

<style scoped>
/* optional styling */
</style>

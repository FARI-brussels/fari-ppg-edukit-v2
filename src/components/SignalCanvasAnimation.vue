<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

const container = ref<HTMLDivElement | null>(null)

const CAPACITY = 1024
const LINE_THICKNESS = 10

let renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.OrthographicCamera,
  lineMesh: THREE.Mesh,
  animationId: number,
  width = 0,
  height = 0,
  time = 0

// Your color palette as THREE.Color instances
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

// Add time parameter to animate waveform horizontally
function heartbeatWaveform(x: number, t: number) {
  // x from 0 to 1 (normalized horizontal position)
  // Animate wave by shifting the input with time 't'
  const beats = 2.5
  const phaseShift = t * 1 // controls speed

  const scaledX = x * beats * Math.PI * 2

  // Wave with time shift to animate horizontally
  const base =
    Math.sin(scaledX - phaseShift) * Math.exp(-((((x * beats - t) % 1) - 0.25) ** 2) * 50) * 4 +
    Math.sin(scaledX * 0.5 - phaseShift * 0.5) * 0.8

  return base
}

function updateLine() {
  if (!lineMesh) return

  const pos = lineMesh.geometry.attributes.position.array as Float32Array
  const colors = lineMesh.geometry.attributes.color.array as Float32Array

  const halfThick = LINE_THICKNESS / 2

  for (let i = 0; i < CAPACITY; i++) {
    const t = i / (CAPACITY - 1) // 0 to 1 along full width

    const x = -width / 2 + t * width

    // Animate waveform with current time
    const yCenter = heartbeatWaveform(t, time) * (height / 10)

    // Approximate tangent for normal vector
    const delta = 1 / CAPACITY
    const yBefore = heartbeatWaveform(Math.max(t - delta, 0), time) * (height / 10)
    const yAfter = heartbeatWaveform(Math.min(t + delta, 1), time) * (height / 10)
    const tangent = new THREE.Vector2(width * delta, yAfter - yBefore).normalize()
    const normal = new THREE.Vector2(-tangent.y, tangent.x)

    // Two vertices per point
    const leftX = x + normal.x * halfThick
    const leftY = yCenter + normal.y * halfThick
    const rightX = x - normal.x * halfThick
    const rightY = yCenter - normal.y * halfThick

    pos[i * 6 + 0] = leftX
    pos[i * 6 + 1] = leftY
    pos[i * 6 + 2] = 0

    pos[i * 6 + 3] = rightX
    pos[i * 6 + 4] = rightY
    pos[i * 6 + 5] = 0

    // Color flowing horizontally with time
    const colorT = (t + time * 0.1) % 1
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
  time += 0.01 // slower smooth animation
  updateLine()
  renderer.render(scene, camera)
  animationId = requestAnimationFrame(animate)
}

function resizeRenderer() {
  if (!container.value) return
  width = container.value.clientWidth
  height = container.value.clientHeight

  renderer.setSize(width, height)

  camera.left = -width / 2
  camera.right = width / 2
  camera.top = height / 2
  camera.bottom = -height / 2
  camera.updateProjectionMatrix()
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  scene = new THREE.Scene()

  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.set(0, 0, 10)
  camera.lookAt(0, 0, 0)

  lineMesh = createWaveLine()
  scene.add(lineMesh)

  container.value?.appendChild(renderer.domElement)

  resizeRenderer()
  window.addEventListener('resize', resizeRenderer)

  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resizeRenderer)
  renderer.dispose()
  lineMesh.geometry.dispose()
  lineMesh.material.dispose()
})
</script>

<template>
  <div
    ref="container"
    style="width: 100%; height: 460px; overflow: hidden; background: transparent"
  ></div>
</template>

<style scoped>
/* optional styling */
</style>

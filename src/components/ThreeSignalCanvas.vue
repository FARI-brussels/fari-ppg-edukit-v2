<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as THREE from 'three'

const props = defineProps({
  data: { type: Array, required: true },
  color: { type: String, default: '#00e5ff' },
  background: { type: String, default: 'transparent' },
})

const container = ref(null)
let renderer, scene, camera, grid, lineMesh, animationId
let width = 0,
  height = 0
const CAPACITY = 1024
const LINE_THICKNESS = 0.5 // Consistent cartoonish width (~6-8 pixels)

function createGrid() {
  const gridGroup = new THREE.Group()
  const gridColor = new THREE.Color('#ffffff')
  const material = new THREE.LineBasicMaterial({
    color: gridColor,
    transparent: true,
    opacity: 0.1,
    linewidth: 1,
  })

  // Horizontal lines only
  const lines = new THREE.Group()
  const ySpan = 12
  for (let y = -ySpan; y <= ySpan; y += 4) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-width / 20, y, 0), // Match camera width
      new THREE.Vector3(width / 20, y, 0),
    ])
    const l = new THREE.Line(geo, material)
    lines.add(l)
  }
  // gridGroup.add(lines)

  return gridGroup
}

function createWaveLine() {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(CAPACITY * 2 * 3) // 2 vertices per point
  const indices = new Uint32Array(CAPACITY * 2 * 3)
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.setDrawRange(0, 0)
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(props.color),
    side: THREE.DoubleSide,
    transparent: false,
  })
  return new THREE.Mesh(geometry, material)
}

function resizeRenderer() {
  if (!container.value) return
  width = container.value.clientWidth
  height = container.value.clientHeight
  renderer.setSize(width, height)
  camera.left = -width / 20
  camera.right = width / 20
  camera.top = height / 20
  camera.bottom = -height / 20
  camera.updateProjectionMatrix()

  // Update grid to match new width
  if (grid) {
    scene.remove(grid)
    grid.traverse((obj) => {
      if (obj.isLine) {
        obj.geometry.dispose()
        obj.material.dispose()
      }
    })
    grid = createGrid()
    scene.add(grid)
  }
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
  if (!lineMesh) return
  const src = props.data || []
  const pos = lineMesh.geometry.attributes.position.array
  const indices = lineMesh.geometry.index.array
  const xSpan = width / 10 // Match camera width (left = -width/20, right = width/20)

  function buildRibbon(samples, startIdx, isRingBuffer) {
    // Compute range
    const { min, max } = computeRange(src)
    const yScale = 12 / (max - min || 1)

    // Collect points for spline
    const points = []
    for (let i = 0; i < samples; i++) {
      const t = i / Math.max(1, samples - 1)
      const x = -xSpan / 2 + t * xSpan // Full camera width
      const v = isRingBuffer ? src[(startIdx + i) % samples] : src[i]
      const y = Number.isFinite(v) ? (v - min) * yScale - 2 : -2
      points.push(new THREE.Vector3(x, y, 0))
    }

    // Create smooth curve
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)
    const curvePoints = curve.getPoints(samples * 2)

    // Compute normals for consistent thickness
    const normals = []
    for (let i = 0; i < curvePoints.length; i++) {
      const prev = i === 0 ? curvePoints[0] : curvePoints[i - 1]
      const curr = curvePoints[i]
      const next = i === curvePoints.length - 1 ? curr : curvePoints[i + 1]
      const tangent = next.clone().sub(prev).normalize()
      const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize()
      normals.push(normal)
    }

    // Build ribbon geometry
    for (let i = 0; i < curvePoints.length; i++) {
      const p = curvePoints[i]
      const n = normals[i]
      const halfThick = LINE_THICKNESS / 2
      pos[i * 6 + 0] = p.x + n.x * halfThick
      pos[i * 6 + 1] = p.y + n.y * halfThick
      pos[i * 6 + 2] = p.z
      pos[i * 6 + 3] = p.x - n.x * halfThick
      pos[i * 6 + 4] = p.y - n.y * halfThick
      pos[i * 6 + 5] = p.z
    }

    // Create triangle indices
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

    lineMesh.geometry.setDrawRange(0, (curvePoints.length - 1) * 6)
    lineMesh.geometry.attributes.position.needsUpdate = true
    lineMesh.geometry.index.needsUpdate = true
  }

  // Ring buffer path
  if (src && src._rbFull === true && typeof src._rbIndex === 'number') {
    const samples = Math.min(src.length, CAPACITY)
    const startIdx = src._rbIndex % samples
    buildRibbon(samples, startIdx, true)
    return
  }

  // Fallback for growing arrays
  const all = src
  const count = Math.min(all.length, CAPACITY)
  const start = Math.max(0, all.length - count)
  const data = all.slice(start)
  const samples = Math.max(2, data.length)
  buildRibbon(samples, 0, false)
}

function animate() {
  updateLine()
  renderer.render(scene, camera)
  animationId = requestAnimationFrame(animate)
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.set(0, 0, 10)
  camera.lookAt(0, 0, 0)

  grid = createGrid()
  scene.add(grid)

  lineMesh = createWaveLine()
  scene.add(lineMesh)

  container.value.appendChild(renderer.domElement)
  resizeRenderer()
  window.addEventListener('resize', resizeRenderer)

  animate()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resizeRenderer)
  if (renderer) renderer.dispose()
  if (lineMesh) {
    lineMesh.geometry.dispose()
    lineMesh.material.dispose()
  }
  if (grid) {
    grid.traverse((obj) => {
      if (obj.isLine) {
        obj.geometry.dispose()
        obj.material.dispose()
      }
    })
  }
})

watch(
  () => props.color,
  (newColor) => {
    if (lineMesh) {
      const startColor = lineMesh.material.color.clone()
      const endColor = new THREE.Color(newColor)
      let t = 0
      const duration = 500
      const transition = () => {
        t += 16 / duration
        if (t >= 1) t = 1
        lineMesh.material.color.lerpColors(startColor, endColor, t)
        if (t < 1) requestAnimationFrame(transition)
      }
      requestAnimationFrame(transition)
    }
  },
)
</script>

<template>
  <div
    ref="container"
    style="width: 100%; height: 460px; overflow: hidden; background: transparent"
  ></div>
</template>

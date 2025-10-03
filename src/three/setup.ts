import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export type ThreeCore = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  composer: EffectComposer
  controls: OrbitControls
  clock: THREE.Clock
  dispose: () => void
  handleResize: () => void
}

export type ThreeSetupOptions = {
  container: HTMLElement
  pixelRatio?: number
  background?: THREE.Color | null | 'transparent'
  cameraFov?: number
}

export function createThreeCore(options: ThreeSetupOptions): ThreeCore {
  const {
    container,
    pixelRatio = window.devicePixelRatio || 1,
    background = null,
    cameraFov = 40,
  } = options
  // const {
  //   container,
  //   pixelRatio = window.devicePixelRatio || 1,
  //   background = new THREE.Color(0x0b1020),
  //   cameraFov = 40,
  // } = options
  console.log({ container })
  const width = container.clientWidth || 200
  const height = container.clientHeight || 200

  const clock = new THREE.Clock()

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
  })
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(width, height, false)
  renderer.setClearColor(0x2e4fbf, -1)

  renderer.domElement.classList.add('rounded')
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  // Set scene background; null for fully transparent, or a concrete THREE.Color
  scene.background = null
  // scene.background = background === 'transparent' ? null : (background ?? null)

  const camera = new THREE.PerspectiveCamera(cameraFov, width / height, 0.1, 1000)
  camera.position.set(3, 1, 1)
  // camera.position.set(0, 0.8, 2)

  // Lighting
  scene.add(new THREE.AmbientLight(0x2e4fbf, 4.2))
  scene.add(new THREE.HemisphereLight(0x2e4fbf, 0x202020, 0.6))
  const rim = new THREE.DirectionalLight(0xffb6c1, 2.0)
  rim.position.set(2, 3, 2)
  scene.add(rim)
  const fill = new THREE.PointLight(0xffa1b5, 80.8, 100)
  fill.position.set(-20, -1, 3)
  scene.add(fill)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 3
  controls.maxDistance = 10
  controls.target.set(0, 0.3, 0)
  // controls.target.set(0, 0.3, 0)

  const composer = new EffectComposer(renderer)
  const renderPass = new RenderPass(scene, camera)
  if (background === null) {
    const rp = renderPass as unknown as { clearAlpha?: number }
    if (typeof rp.clearAlpha === 'number') rp.clearAlpha = 0
  }
  composer.addPass(renderPass)
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.2, 0.4, 0.1)
  bloomPass.strength = 0.15
  composer.addPass(bloomPass)

  function handleResize() {
    const w = container.clientWidth || 400
    const h = container.clientHeight || 300
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    composer.setSize(w, h)
  }

  function dispose() {
    renderer.dispose()
    renderer.forceContextLoss()
    // @ts-expect-error - we intentionally clear to help GC on teardown
    renderer.domElement = null
  }

  return { renderer, scene, camera, composer, controls, clock, dispose, handleResize }
}

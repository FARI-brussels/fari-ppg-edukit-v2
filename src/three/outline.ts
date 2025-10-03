import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'

export function addOutlinePass(
  composer: EffectComposer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  selectedObjects: THREE.Object3D[],
  options?: {
    edgeStrength?: number
    edgeGlow?: number
    edgeThickness?: number
    visibleEdgeColor?: number
    hiddenEdgeColor?: number
  },
) {
  const size = new THREE.Vector2()
  composer.renderer.getSize(size)
  const pass = new OutlinePass(size, scene, camera, selectedObjects)
  pass.edgeStrength = options?.edgeStrength ?? 6.0
  pass.edgeGlow = options?.edgeGlow ?? 0.0
  pass.edgeThickness = options?.edgeThickness ?? 1.5
  pass.visibleEdgeColor.set(options?.visibleEdgeColor ?? 0x64d8bf)
  pass.hiddenEdgeColor.set(options?.hiddenEdgeColor ?? 0x64d8bf)
  composer.addPass(pass)
  return pass
}

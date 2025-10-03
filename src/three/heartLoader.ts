import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export type HeartLoadOptions = {
  url: string
  fallbackGeometry?: THREE.BufferGeometry
  materialFactory?: () => THREE.Material
}

export type LoadedHeart = {
  group: THREE.Group
  meshes: THREE.Mesh[]
  baseScale: THREE.Vector3
}

export async function loadHeartModel(options: HeartLoadOptions): Promise<LoadedHeart> {
  const { url, fallbackGeometry = new THREE.SphereGeometry(0.9, 32, 32), materialFactory } = options
  const loader = new GLTFLoader()
  try {
    const gltf = await loader.loadAsync(url)
    const obj = gltf.scene || gltf.scenes?.[0]
    if (!obj) throw new Error('No scene in glTF')

    const group = new THREE.Group()
    group.add(obj)

    const box = new THREE.Box3().setFromObject(group)
    const size = new THREE.Vector3()
    box.getSize(size)
    const scaleFactor = 1.1 / Math.max(size.x, size.y, size.z)
    group.scale.setScalar(scaleFactor)

    box.setFromObject(group)
    const center = new THREE.Vector3()
    box.getCenter(center)
    group.position.sub(center)
    group.position.y += 0.1

    const meshes: THREE.Mesh[] = []
    group.traverse((node: THREE.Object3D) => {
      if (node instanceof THREE.Mesh) {
        // Ensure normals exist for toon shading
        const geometry = node.geometry as THREE.BufferGeometry
        if (!geometry.attributes.normal) {
          geometry.computeVertexNormals()
        }
        if (materialFactory) {
          node.material = materialFactory()
        } else if (!(node.material && node.material.isMeshStandardMaterial)) {
          node.material = new THREE.MeshStandardMaterial({ color: 0xff2e63, roughness: 0.5 })
        }
        node.castShadow = true
        node.receiveShadow = true
        meshes.push(node)
      }
    })

    const baseScale = new THREE.Vector3().copy(group.scale)
    return { group, meshes, baseScale }
  } catch (err) {
    console.error('Failed to load heart model:', err)
    const fallback = new THREE.Mesh(
      fallbackGeometry,
      materialFactory
        ? materialFactory()
        : new THREE.MeshStandardMaterial({ color: 0xff2e63, roughness: 0.45 }),
    )
    fallback.position.y = 0.1
    const group = new THREE.Group()
    group.add(fallback)
    return { group, meshes: [fallback], baseScale: new THREE.Vector3(1, 1, 1) }
  }
}

import * as THREE from 'three'

export type ToonOptions = {
  color?: number
  gradientStops?: number
}

function generateToonGradient(stops: number): THREE.Texture {
  const size = Math.max(2, Math.min(256, stops))
  const data = new Uint8Array(size)
  for (let i = 0; i < size; i++) {
    const step = Math.floor((i / (size - 1)) * 255)
    data[i] = step
  }
  // Prefer RedFormat for current three versions; fall back to LuminanceFormat if needed
  const format = (THREE as any).RedFormat ?? (THREE as any).LuminanceFormat
  const texture = new THREE.DataTexture(data, size, 1, format, THREE.UnsignedByteType)
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  // Use NoColorSpace so it is treated as a LUT, not color data
  ;(texture as any).colorSpace = (THREE as any).NoColorSpace ?? (THREE as any).LinearSRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function createToonMaterialFactory(options?: ToonOptions) {
  const { color = 0xff2e63, gradientStops = 3 } = options || {}
  const gradientMap = generateToonGradient(gradientStops)
  return () =>
    new THREE.MeshToonMaterial({
      color,
      gradientMap,
      flatShading: true,
      side: THREE.FrontSide,
      toneMapped: false,
    })
}

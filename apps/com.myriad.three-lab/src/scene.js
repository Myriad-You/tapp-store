const THREE = globalThis.THREE
const GLTFLoader = globalThis.GLTFLoader

const TEXTURE_PATH = 'assets/check.png'
const MODEL_PATH = 'assets/cube.glb'

function t(key) {
  try {
    if (typeof Tapp !== 'undefined' && Tapp.i18n && typeof Tapp.i18n.t === 'function') {
      return Tapp.i18n.t(key)
    }
  } catch (_) {
    /* optional in local harness */
  }
  return key
}

function applyStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n)
  })
}

async function loadPackagedScene() {
  await Tapp.assets.getUrlMap()
  const manager = new THREE.LoadingManager()
  manager.setURLModifier((url) => Tapp.assets.rewriteUrl(url))
  const texture = await new THREE.TextureLoader(manager).loadAsync(TEXTURE_PATH)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  const gltf = await new GLTFLoader(manager).loadAsync(MODEL_PATH)
  return { texture, model: gltf.scene }
}

function setStatus(message) {
  const status = document.getElementById('lab-status')
  if (status) status.textContent = message
}

async function start() {
  applyStaticI18n()

  if (!THREE || !GLTFLoader) {
    setStatus(t('missingCanvas'))
    console.error('[three-lab] host THREE/GLTFLoader missing; declare runtimeModules: ["three"]')
    return
  }

  const canvas = document.getElementById('lab-canvas')
  const spinButton = document.getElementById('lab-spin')
  const fullscreenButton = document.getElementById('lab-fullscreen')
  if (!canvas) {
    setStatus(t('missingCanvas'))
    return
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50)
  camera.position.set(2.4, 1.6, 3.2)
  camera.lookAt(0, 0.15, 0)

  scene.add(new THREE.AmbientLight(0xffffff, 0.55))
  const key = new THREE.DirectionalLight(0xffffff, 1.05)
  key.position.set(3, 5, 2)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0x93c5fd, 0.35)
  fill.position.set(-3, 1, -2)
  scene.add(fill)

  const { texture, model } = await loadPackagedScene()
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.1, 1.1),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.45, metalness: 0.08 }),
  )
  floor.position.set(-0.85, 0, 0)
  scene.add(floor)

  model.position.set(0.95, 0, 0)
  scene.add(model)

  const pivot = new THREE.Group()
  pivot.add(floor)
  pivot.add(model)
  scene.add(pivot)

  let raf = 0
  let paused = false
  let spinning = true
  let disposed = false
  let pointerId = null
  let lastX = 0
  let yaw = 0.4
  let pitch = 0.18

  function resize() {
    const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 640
    const height = canvas.clientHeight || 420
    renderer.setSize(width, height, false)
    camera.aspect = width / Math.max(height, 1)
    camera.updateProjectionMatrix()
  }

  function frame() {
    if (disposed) return
    raf = requestAnimationFrame(frame)
    if (paused) return
    if (spinning) yaw += 0.006
    pivot.rotation.y = yaw
    pivot.rotation.x = pitch
    renderer.render(scene, camera)
  }

  function syncSpinLabel() {
    if (spinButton) spinButton.textContent = spinning ? t('spinPause') : t('spinResume')
  }

  spinButton?.addEventListener('click', () => {
    spinning = !spinning
    syncSpinLabel()
  })

  fullscreenButton?.addEventListener('click', () => {
    if (typeof Tapp?.ui?.requestFullscreen === 'function') {
      Tapp.ui.requestFullscreen()
    }
  })

  canvas.addEventListener('pointerdown', (event) => {
    pointerId = event.pointerId
    lastX = event.clientX
    canvas.setPointerCapture(event.pointerId)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId) return
    yaw += (event.clientX - lastX) * 0.008
    lastX = event.clientX
  })
  canvas.addEventListener('pointerup', (event) => {
    if (pointerId === event.pointerId) pointerId = null
  })

  const observer = new ResizeObserver(resize)
  observer.observe(canvas.parentElement || canvas)
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    paused = true
    setStatus(t('contextLost'))
  })

  Tapp.lifecycle.onPause(() => {
    paused = true
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  })
  Tapp.lifecycle.onResume(() => {
    if (disposed) return
    paused = false
    if (!raf) frame()
  })
  Tapp.lifecycle.onDestroy(() => {
    disposed = true
    paused = true
    if (raf) cancelAnimationFrame(raf)
    observer.disconnect()
    texture.dispose()
    floor.geometry.dispose()
    floor.material.dispose()
    model.traverse((node) => {
      if (node.geometry) node.geometry.dispose()
      if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material]
        for (const material of materials) material.dispose()
      }
    })
    renderer.dispose()
    Tapp.assets.revokeAll()
  })

  resize()
  syncSpinLabel()
  setStatus(t('ready'))
  frame()
}

Tapp.lifecycle.onReady(() => {
  start().catch((error) => {
    console.error(error)
    setStatus(t('failed'))
  })
})

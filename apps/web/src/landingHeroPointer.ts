const POINTER_QUERY = '(pointer: fine) and (prefers-reduced-motion: no-preference)'

let frameId = 0
let currentX = 0
let currentY = 0
let targetX = 0
let targetY = 0

function setHeroMotion(x: number, y: number) {
  const composition = document.querySelector<HTMLElement>('.rf3-hero-composition')
  if (!composition) return

  composition.style.setProperty('--hero-x', `${x.toFixed(2)}px`)
  composition.style.setProperty('--hero-y', `${y.toFixed(2)}px`)
  composition.style.setProperty('--hero-x-rev', `${(-x * 0.66).toFixed(2)}px`)
  composition.style.setProperty('--hero-y-rev', `${(-y * 0.72).toFixed(2)}px`)
  composition.style.setProperty('--hero-rx', `${(-y * 0.12).toFixed(2)}deg`)
  composition.style.setProperty('--hero-ry', `${(x * 0.14).toFixed(2)}deg`)
}

function animate() {
  currentX += (targetX - currentX) * 0.085
  currentY += (targetY - currentY) * 0.085
  setHeroMotion(currentX, currentY)

  if (Math.abs(targetX - currentX) > 0.04 || Math.abs(targetY - currentY) > 0.04) {
    frameId = window.requestAnimationFrame(animate)
  } else {
    frameId = 0
  }
}

function schedule() {
  if (!frameId) frameId = window.requestAnimationFrame(animate)
}

export function installLandingHeroPointer() {
  if (!window.matchMedia(POINTER_QUERY).matches) return

  window.addEventListener('pointermove', (event) => {
    const hero = document.querySelector<HTMLElement>('.rf3-hero')
    const composition = document.querySelector<HTMLElement>('.rf3-hero-composition')
    if (!hero || !composition) return

    const rect = hero.getBoundingClientRect()
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom

    if (!inside) {
      targetX = 0
      targetY = 0
      schedule()
      return
    }

    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5

    targetX = Math.max(-1, Math.min(1, x * 2)) * 18
    targetY = Math.max(-1, Math.min(1, y * 2)) * 12
    schedule()
  })

  window.addEventListener('blur', () => {
    targetX = 0
    targetY = 0
    schedule()
  })
}

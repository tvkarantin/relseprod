const POINTER_QUERY = '(pointer: fine) and (prefers-reduced-motion: no-preference)'

const REAL_REEL_EMBED = 'https://www.instagram.com/reel/DBUpNT4Nllw/embed/'

let frameId = 0
let currentX = 0
let currentY = 0
let targetX = 0
let targetY = 0

function hydrateRealHeroReel(): boolean {
  const reel = document.querySelector<HTMLElement>('.rf3-main-reel')
  if (!reel) return false

  if (!reel.querySelector('.rf3-real-instagram-embed')) {
    const media = reel.querySelector<HTMLElement>(':scope > img, :scope > video')
    const iframe = document.createElement('iframe')
    iframe.className = 'rf3-real-instagram-embed'
    iframe.src = REAL_REEL_EMBED
    iframe.title = 'Instagram Reel @hormozi'
    iframe.loading = 'eager'
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture'
    iframe.setAttribute('allowfullscreen', 'true')
    iframe.setAttribute('scrolling', 'no')
    iframe.setAttribute('frameborder', '0')
    if (media) media.replaceWith(iframe)
    else reel.prepend(iframe)
  }

  const creatorCard = document.querySelector<HTMLElement>('.rf3-creator-card')
  if (creatorCard) creatorCard.setAttribute('aria-hidden', 'true')

  const viralCard = document.querySelector<HTMLElement>('.rf3-viral-card')
  const viralLabel = viralCard?.querySelector<HTMLElement>('small')
  const viralValue = viralCard?.querySelector<HTMLElement>(':scope > strong')
  if (viralLabel) viralLabel.textContent = 'Reel выше среднего'
  if (viralValue) viralValue.textContent = '3.5M+'

  return true
}

function installHeroMediaHydration() {
  if (hydrateRealHeroReel()) return

  const observer = new MutationObserver(() => {
    if (!hydrateRealHeroReel()) return
    observer.disconnect()
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })
}

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
  installHeroMediaHydration()

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

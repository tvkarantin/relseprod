const POINTER_QUERY = '(pointer: fine) and (prefers-reduced-motion: no-preference)'

const REAL_REEL_VIDEO =
  'https://tphahouachokghqlsczf.supabase.co/functions/v1/instagram-imginn?media=DMpuiXeubFY&forceFunctionRegion=ap-northeast-1'
const REAL_REEL_POSTER =
  'https://tphahouachokghqlsczf.supabase.co/functions/v1/instagram-imginn?thumbnail=DMpuiXeubFY&forceFunctionRegion=ap-northeast-1&username=garyvee'
const CREATOR_AVATAR =
  'https://garyvaynerchuk.com/wp-content/uploads/2026/01/Gary-ChukMedia-headshot-390x585.jpg'

let frameId = 0
let currentX = 0
let currentY = 0
let targetX = 0
let targetY = 0

function hydrateRealHeroReel(): boolean {
  const reel = document.querySelector<HTMLElement>('.rf3-main-reel')
  if (!reel) return false

  const currentMedia = reel.querySelector<HTMLElement>(
    ':scope > img, :scope > video, :scope > iframe',
  )

  if (!reel.querySelector('.rf3-real-reel-video')) {
    const video = document.createElement('video')
    video.className = 'rf3-real-reel-video'
    video.src = REAL_REEL_VIDEO
    video.poster = REAL_REEL_POSTER
    video.muted = true
    video.loop = true
    video.autoplay = true
    video.playsInline = true
    video.preload = 'metadata'
    video.setAttribute('aria-label', 'Instagram Reel @garyvee')
    video.addEventListener('canplay', () => {
      void video.play().catch(() => undefined)
    })

    if (currentMedia) currentMedia.replaceWith(video)
    else reel.prepend(video)
  }

  const creatorCard = document.querySelector<HTMLElement>('.rf3-creator-card')
  if (creatorCard) {
    creatorCard.removeAttribute('aria-hidden')
    const avatar = creatorCard.querySelector<HTMLElement>('.rf3-avatar')
    const username = creatorCard.querySelector<HTMLElement>('strong')
    const followers = creatorCard.querySelector<HTMLElement>('small')

    if (avatar && !avatar.querySelector('img')) {
      avatar.textContent = ''
      const image = document.createElement('img')
      image.src = CREATOR_AVATAR
      image.alt = 'Gary Vaynerchuk'
      image.loading = 'eager'
      image.referrerPolicy = 'no-referrer'
      avatar.append(image)
    }
    if (username) username.textContent = '@garyvee'
    if (followers) followers.textContent = '11.8M подписчиков'
  }

  const viralCard = document.querySelector<HTMLElement>('.rf3-viral-card')
  const viralLabel = viralCard?.querySelector<HTMLElement>('small')
  const viralValue = viralCard?.querySelector<HTMLElement>(':scope > strong')
  if (viralLabel) viralLabel.textContent = 'Аудитория автора'
  if (viralValue) viralValue.textContent = '11.8M'

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

const POINTER_QUERY = '(pointer: fine) and (prefers-reduced-motion: no-preference)'

const REAL_REEL_VIDEO =
  'https://tphahouachokghqlsczf.supabase.co/functions/v1/instagram-imginn?media=Dbn6ElTvw_W&forceFunctionRegion=ap-northeast-1'
const REAL_REEL_POSTER =
  'https://tphahouachokghqlsczf.supabase.co/functions/v1/instagram-imginn?thumbnail=Dbn6ElTvw_W&forceFunctionRegion=ap-northeast-1&username=nick_saraev'
const REAL_CREATOR_AVATAR =
  'https://storage.ghost.io/c/1a/e3/1ae3de90-cafc-423f-b6a1-36af422be674/content/images/size/w256/2024/02/social_media-3.png'

let frameId = 0
let currentX = 0
let currentY = 0
let targetX = 0
let targetY = 0

function hydrateRealHeroReel(): boolean {
  const reel = document.querySelector<HTMLElement>('.rf3-main-reel')
  const creatorCard = document.querySelector<HTMLElement>('.rf3-creator-card')
  if (!reel || !creatorCard) return false

  if (!reel.querySelector('.rf3-real-reel-video')) {
    const image = reel.querySelector<HTMLImageElement>(':scope > img')
    const video = document.createElement('video')
    video.className = 'rf3-real-reel-video'
    video.src = REAL_REEL_VIDEO
    video.poster = REAL_REEL_POSTER
    video.autoplay = true
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.preload = 'metadata'
    video.setAttribute('aria-label', 'Reel автора @nick_saraev')
    if (image) image.replaceWith(video)
    else reel.prepend(video)
    void video.play().catch(() => undefined)
  }

  const avatar = creatorCard.querySelector<HTMLElement>('.rf3-avatar')
  if (avatar && avatar.tagName !== 'IMG') {
    const avatarImage = document.createElement('img')
    avatarImage.className = 'rf3-avatar rf3-real-avatar'
    avatarImage.src = REAL_CREATOR_AVATAR
    avatarImage.alt = 'Nick Saraev'
    avatarImage.loading = 'eager'
    avatarImage.decoding = 'async'
    avatar.replaceWith(avatarImage)
  }

  const creatorName = creatorCard.querySelector<HTMLElement>('strong')
  const creatorMeta = creatorCard.querySelector<HTMLElement>('small')
  if (creatorName) creatorName.textContent = '@nick_saraev'
  if (creatorMeta) creatorMeta.textContent = 'Instagram · AI и автоматизация'

  const stats = reel.querySelector<HTMLElement>('.rf3-reel-stats')
  if (stats) stats.textContent = '422K просмотров · x13.3'

  const copy = reel.querySelector<HTMLElement>('.rf3-reel-copy > p')
  if (copy) copy.textContent = '5 Claude Code plugins, которые реально ускоряют работу'

  const viralCard = document.querySelector<HTMLElement>('.rf3-viral-card')
  const viralLabel = viralCard?.querySelector<HTMLElement>('small')
  const viralValue = viralCard?.querySelector<HTMLElement>(':scope > strong')
  if (viralLabel) viralLabel.textContent = 'Выше среднего аккаунта'
  if (viralValue) viralValue.textContent = 'x13.3'

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

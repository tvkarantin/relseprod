import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  CREATOR_PROFILE_STORAGE_KEY,
  CREATOR_PROFILE_UPDATED_EVENT,
  loadCreatorProfile,
  saveCreatorProfile,
  type AppLanguage,
  type CreatorProfile,
} from '@/types/creatorProfile'
import { translateUiText } from './translations'

interface LanguageContextValue {
  language: AppLanguage
  locale: 'ru-RU' | 'en-US'
  t: (value: string) => string
  setLanguage: (language: AppLanguage) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const textOriginals = new WeakMap<Text, string>()
const attributeOriginals = new WeakMap<Element, Map<string, string>>()
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'aria-label', 'title'] as const

function getTextOriginal(node: Text, language: AppLanguage): string {
  const current = node.nodeValue ?? ''
  const previous = textOriginals.get(node)
  if (previous === undefined) {
    textOriginals.set(node, current)
    return current
  }

  const previousEnglish = translateUiText(previous, 'en')
  const isReactSourceUpdate =
    current !== previous &&
    current !== previousEnglish &&
    (language === 'ru' || translateUiText(current, 'en') !== current || /[А-Яа-яЁё]/.test(current))

  if (isReactSourceUpdate) {
    textOriginals.set(node, current)
    return current
  }

  return previous
}

function localizeTextNode(node: Text, language: AppLanguage): void {
  const original = getTextOriginal(node, language)
  const next = translateUiText(original, language)
  if (node.nodeValue !== next) node.nodeValue = next
}

function localizeAttribute(element: Element, attribute: string, language: AppLanguage): void {
  const current = element.getAttribute(attribute)
  if (current === null) return

  let originals = attributeOriginals.get(element)
  if (!originals) {
    originals = new Map<string, string>()
    attributeOriginals.set(element, originals)
  }

  const previous = originals.get(attribute)
  let original = previous ?? current
  if (previous === undefined) {
    originals.set(attribute, current)
  } else {
    const previousEnglish = translateUiText(previous, 'en')
    if (current !== previous && current !== previousEnglish) {
      original = current
      originals.set(attribute, current)
    }
  }

  const next = translateUiText(original, language)
  if (current !== next) element.setAttribute(attribute, next)
}

function localizeElement(element: Element, language: AppLanguage): void {
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    localizeAttribute(element, attribute, language)
  }

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      localizeTextNode(child as Text, language)
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      localizeElement(child as Element, language)
    }
  }
}

function localizeMutationNode(node: Node, language: AppLanguage): void {
  if (node.nodeType === Node.TEXT_NODE) {
    localizeTextNode(node as Text, language)
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    localizeElement(node as Element, language)
  }
}

export function getAppLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'ru'
  return loadCreatorProfile().language === 'en' ? 'en' : 'ru'
}

export function getAppLocale(): 'ru-RU' | 'en-US' {
  return getAppLanguage() === 'en' ? 'en-US' : 'ru-RU'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => getAppLanguage())

  useEffect(() => {
    const onProfileUpdated = (event: Event) => {
      const profile = (event as CustomEvent<CreatorProfile>).detail
      setLanguageState(profile?.language === 'en' ? 'en' : getAppLanguage())
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === CREATOR_PROFILE_STORAGE_KEY) setLanguageState(getAppLanguage())
    }

    window.addEventListener(CREATOR_PROFILE_UPDATED_EVENT, onProfileUpdated)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CREATOR_PROFILE_UPDATED_EVENT, onProfileUpdated)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
    if (document.body) localizeElement(document.body, language)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          localizeMutationNode(mutation.target, language)
          continue
        }
        if (mutation.type === 'attributes') {
          const attribute = mutation.attributeName
          if (attribute && TRANSLATABLE_ATTRIBUTES.includes(attribute as never)) {
            localizeAttribute(mutation.target as Element, attribute, language)
          }
          continue
        }
        for (const node of Array.from(mutation.addedNodes)) {
          localizeMutationNode(node, language)
        }
      }
    })

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    })
    return () => observer.disconnect()
  }, [language])

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      locale: language === 'en' ? 'en-US' : 'ru-RU',
      t: (text: string) => translateUiText(text, language),
      setLanguage: (nextLanguage: AppLanguage) => {
        const profile = loadCreatorProfile()
        saveCreatorProfile({ ...profile, language: nextLanguage })
      },
    }),
    [language],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used within LanguageProvider')
  return value
}

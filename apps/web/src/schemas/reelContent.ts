import { z } from 'zod'

export const CONTENT_LIMITS = {
  hook: 500,
  script: 10_000,
  cta: 1_000,
  notes: 10_000,
} as const

export const contentStatusSchema = z.enum([
  'new',
  'idea',
  'script',
  'ready',
  'published',
  'archived',
])

/**
 * Editor schema. Text fields are never trimmed: the user's line breaks and
 * indentation are part of the script.
 */
export const reelContentSchema = z.object({
  hook: z.string().max(CONTENT_LIMITS.hook, `Максимум ${CONTENT_LIMITS.hook} символов`),
  script: z.string().max(CONTENT_LIMITS.script, `Максимум ${CONTENT_LIMITS.script} символов`),
  cta: z.string().max(CONTENT_LIMITS.cta, `Максимум ${CONTENT_LIMITS.cta} символов`),
  notes: z.string().max(CONTENT_LIMITS.notes, `Максимум ${CONTENT_LIMITS.notes} символов`),
  contentStatus: contentStatusSchema,
})

export type ReelContentFormValues = z.infer<typeof reelContentSchema>

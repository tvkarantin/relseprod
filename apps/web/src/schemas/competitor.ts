import { z } from 'zod'

export const competitorFormSchema = z.object({
  profile: z
    .string()
    .trim()
    .min(1, 'Укажите username или ссылку на профиль')
    .max(500, 'Слишком длинное значение'),
})

export type CompetitorFormValues = z.infer<typeof competitorFormSchema>

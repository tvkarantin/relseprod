import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/Button'
import { competitorFormSchema, type CompetitorFormValues } from '@/schemas/competitor'

interface AddCompetitorFormProps {
  isPending: boolean
  serverError: string | null
  onSubmit: (profile: string) => Promise<void>
}

export function AddCompetitorForm({ isPending, serverError, onSubmit }: AddCompetitorFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CompetitorFormValues>({
    resolver: zodResolver(competitorFormSchema),
    defaultValues: { profile: '' },
  })

  const submit = handleSubmit(async (values) => {
    await onSubmit(values.profile)
    reset({ profile: '' })
  })

  const errorMessage = errors.profile?.message ?? serverError

  return (
    // Enter submits natively because this is a real <form>.
    <form className="surface" style={{ padding: 16 }} onSubmit={submit} noValidate>
      <div className="inline-form">
        <div className="field">
          <label className="field-label" htmlFor="competitor-profile">
            Instagram-аккаунт конкурента
          </label>
          <input
            id="competitor-profile"
            className="input"
            placeholder="username, @username или https://instagram.com/username"
            autoComplete="off"
            disabled={isPending}
            aria-invalid={errorMessage ? true : undefined}
            aria-describedby={errorMessage ? 'competitor-profile-error' : undefined}
            {...register('profile')}
          />
        </div>
        <Button type="submit" variant="primary" disabled={isPending} style={{ marginTop: 23 }}>
          {isPending ? 'Добавляем…' : 'Добавить'}
        </Button>
      </div>

      {errorMessage ? (
        <p className="field-error" id="competitor-profile-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </form>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import {
  createCompetitor,
  deleteCompetitor,
  fetchCompetitors,
  startImport,
} from '@/api/competitors'
import { queryKeys } from '@/api/queryKeys'
import { AddCompetitorForm } from '@/components/competitors/AddCompetitorForm'
import { CompetitorRow } from '@/components/competitors/CompetitorRow'
import { EmptyState, ErrorState, RowSkeletons } from '@/components/feedback/States'
import { useToast } from '@/components/feedback/toastContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Competitor } from '@/types/competitor'
import { getCompetitorFormError, getErrorMessage } from '@/utils/errors'

export function CompetitorsPage() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Competitor | null>(null)
  /** Jobs started in this browser session, keyed by competitor id. */
  const [activeJobs, setActiveJobs] = useState<Record<number, number>>({})
  const [startingId, setStartingId] = useState<number | null>(null)

  const competitorsQuery = useQuery({
    queryKey: queryKeys.competitors.list(),
    queryFn: ({ signal }) => fetchCompetitors(signal),
  })

  const invalidateCompetitors = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.competitors.all() })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: (profile: string) => createCompetitor(profile),
    onSuccess: (competitor) => {
      setFormError(null)
      toast.success(`Конкурент @${competitor.instagramUsername} добавлен`)
      invalidateCompetitors()
    },
    onError: (error) => setFormError(getCompetitorFormError(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (competitor: Competitor) => deleteCompetitor(competitor.id),
    onSuccess: (_data, competitor) => {
      toast.success(`Конкурент @${competitor.instagramUsername} удалён`)
      setActiveJobs((current) => {
        const next = { ...current }
        delete next[competitor.id]
        return next
      })
      setPendingDelete(null)
      invalidateCompetitors()
      void queryClient.invalidateQueries({ queryKey: queryKeys.reels.all() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
      setPendingDelete(null)
    },
  })

  const handleStartImport = useCallback(
    async (competitor: Competitor) => {
      setStartingId(competitor.id)
      try {
        const started = await startImport(competitor.id)
        setActiveJobs((current) => ({ ...current, [competitor.id]: started.jobId }))
        toast.info(`Импорт @${competitor.instagramUsername} запущен`)
        invalidateCompetitors()
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        setStartingId(null)
      }
    },
    [toast, invalidateCompetitors],
  )

  const handleCreate = useCallback(
    async (profile: string) => {
      setFormError(null)
      await createMutation.mutateAsync(profile).catch(() => {
        // The error is already surfaced through `formError`; swallow it so the
        // form does not reset the field the user is fixing.
      })
    },
    [createMutation],
  )

  const competitors = competitorsQuery.data ?? []

  return (
    <div className="page-content">
      <PageHeader
        title="Конкуренты"
        description="Добавьте Instagram-аккаунты и импортируйте их рилсы через Apify"
      />

      <AddCompetitorForm
        isPending={createMutation.isPending}
        serverError={formError}
        onSubmit={handleCreate}
      />

      <h2 className="section-title">Отслеживаемые аккаунты</h2>

      {competitorsQuery.isLoading ? (
        <RowSkeletons count={3} />
      ) : competitorsQuery.isError ? (
        <ErrorState error={competitorsQuery.error} onRetry={() => void competitorsQuery.refetch()} />
      ) : competitors.length === 0 ? (
        <EmptyState
          icon="◎"
          title="Пока нет конкурентов"
          description="Добавьте первый Instagram-аккаунт конкурента, чтобы импортировать его рилсы."
        />
      ) : (
        <div className="surface">
          {competitors.map((competitor) => (
            <CompetitorRow
              key={competitor.id}
              competitor={competitor}
              jobId={activeJobs[competitor.id] ?? null}
              isStarting={startingId === competitor.id}
              onStartImport={(item) => void handleStartImport(item)}
              onDelete={setPendingDelete}
              onJobSettled={invalidateCompetitors}
            />
          ))}
        </div>
      )}

      {pendingDelete ? (
        <ConfirmDialog
          title={`Удалить @${pendingDelete.instagramUsername}?`}
          description="Вместе с конкурентом будут удалены все его импортированные рилсы и написанные вами сценарии. Действие необратимо."
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  )
}

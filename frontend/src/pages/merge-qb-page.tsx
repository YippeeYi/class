import { PageHeading } from '@/components/archive/page-heading'
import { MergeQbBoard } from '@/features/games/merge-qb/game-board'

export function MergeQbPage() {
  return (
    <div className="merge-qb-page">
      <PageHeading title="合成大QB" />
      <MergeQbBoard />
    </div>
  )
}

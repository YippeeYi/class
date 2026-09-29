import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

import { PageHeading } from '@/components/archive/page-heading'
import { Button } from '@/components/ui/button'
import { MergeQbBoard } from '@/features/games/merge-qb/game-board'

export function MergeQbPage() {
  return (
    <div>
      <PageHeading
        title="合成大QB"
        description="让相同等级的QB相遇，看看你能合成多大。"
        showTitleInContent
        actions={
          <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/games" />}>
            <ArrowLeft aria-hidden="true" />
            返回游戏库
          </Button>
        }
      />
      <MergeQbBoard />
    </div>
  )
}

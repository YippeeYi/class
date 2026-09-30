import { Gamepad2 } from 'lucide-react'
import { Link } from 'react-router'

import { interactiveSurfaceVariants } from '@/components/archive/interaction'
import { PageHeading } from '@/components/archive/page-heading'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

const games = [
  {
    id: 'merge-qb',
    title: '合成大QB',
    description: '移动并落下小QB，让相同等级的两个合成更大的QB。',
    to: '/games/merge-qb',
  },
] as const

export function GamesPage() {
  return (
    <div>
      <PageHeading title="小游戏" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <Link
            key={game.id}
            to={game.to}
            className={`${interactiveSurfaceVariants({ kind: 'card' })} block min-w-0`}
          >
            <Card className="min-w-0 gap-4 bg-card/80 group-hover:bg-accent/50 group-focus-visible:bg-accent/50 group-active:bg-accent/70">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Gamepad2 className="size-5" aria-hidden="true" />
                </div>
                <CardTitle>{game.title}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

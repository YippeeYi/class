import { ArrowRight, Gamepad2 } from 'lucide-react'
import { Link } from 'react-router'

import { PageHeading } from '@/components/archive/page-heading'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
      <PageHeading title="小游戏" description="选一个小游戏，随时开始。" showTitleInContent />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((game) => (
          <Card key={game.id} className="min-w-0 gap-4 bg-card/80">
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Gamepad2 className="size-5" aria-hidden="true" />
              </div>
              <CardTitle>{game.title}</CardTitle>
              <CardDescription>{game.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button nativeButton={false} render={<Link to={game.to} />}>
                进入游戏
                <ArrowRight aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

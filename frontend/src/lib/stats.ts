import { countTextCharacters, extractAuthorIds, extractParticipantIds } from '@/lib/markup'
import type { RecordItem } from '@/types/domain'

export function buildPeopleStats(records: RecordItem[]) {
  const participation = new Map<string, number>()
  const authored = new Map<string, number>()
  const characters = new Map<string, number>()
  for (const record of records) {
    for (const id of extractParticipantIds(record.content))
      participation.set(id, (participation.get(id) || 0) + 1)
    for (const id of extractAuthorIds(record)) authored.set(id, (authored.get(id) || 0) + 1)
    if (record.author)
      characters.set(
        record.author,
        (characters.get(record.author) || 0) + countTextCharacters(record.content),
      )
  }
  return { participation, authored, characters }
}

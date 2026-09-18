import { useSyncExternalStore } from 'react'
import { getDataVersion, subscribeDataVersion } from '@/services/data-revision'

const subscribeNone = () => () => {}
const emptyVersion = () => ''
export function useDataVersion(enabled = true) {
  return useSyncExternalStore(
    enabled ? subscribeDataVersion : subscribeNone,
    enabled ? getDataVersion : emptyVersion,
    emptyVersion,
  )
}

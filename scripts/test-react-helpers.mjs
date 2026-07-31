import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const frontend = path.join(root, 'frontend')
export const readFrontend = (relative) => readFile(path.join(frontend, relative), 'utf8')
export const existsFrontend = (relative) => access(path.join(frontend, relative), constants.F_OK).then(() => true, () => false)

export async function loadTypescriptModule(relative) {
  return import(pathToFileURL(path.join(frontend, relative)).href)
}

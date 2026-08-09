import { access, readdir } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const requiredNode = [22, 12, 0]
const currentNode = process.versions.node.split('.').map(Number)

function versionAtLeast(current, required) {
  for (let index = 0; index < required.length; index += 1) {
    const difference = (current[index] || 0) - required[index]
    if (difference !== 0) return difference > 0
  }
  return true
}

async function exists(relativePath) {
  return access(path.join(root, relativePath)).then(
    () => true,
    () => false,
  )
}

async function platformPackages() {
  const dependencyRoots = ['node_modules', 'frontend/node_modules']
  const packageRoots = dependencyRoots.flatMap((dependencyRoot) => [
    [`${dependencyRoot}/@biomejs`, /^cli-(darwin|linux|win32)-/],
    [`${dependencyRoot}/@rolldown`, /^binding-(darwin|linux|win32)-/],
    [`${dependencyRoot}/@tailwindcss`, /^oxide-(darwin|linux|win32)-/],
    [`${dependencyRoot}/@typescript`, /^typescript-(darwin|linux|win32)-/],
    [dependencyRoot, /^lightningcss-(darwin|linux|win32)-/],
  ])
  const installed = []

  for (const [relativeDirectory, pattern] of packageRoots) {
    const entries = await readdir(path.join(root, relativeDirectory)).catch(() => [])
    for (const entry of entries) {
      const match = pattern.exec(entry)
      if (match) installed.push({ name: entry, platform: match[1] })
    }
  }

  return installed
}

const errors = []

if (!versionAtLeast(currentNode, requiredNode)) {
  errors.push(`Node.js ${process.versions.node} is too old; install Node.js 22.12.0 or newer.`)
}

const hasInstalledCli =
  (await exists('node_modules/.bin/vite')) || (await exists('frontend/node_modules/.bin/vite'))
if (!hasInstalledCli) {
  errors.push('Dependencies are missing; run npm ci from the repository root.')
}

const nativePackages = await platformPackages()
const foreignPackages = nativePackages.filter(({ platform }) => platform !== process.platform)
const currentPackages = nativePackages.filter(({ platform }) => platform === process.platform)

if (foreignPackages.length) {
  errors.push(
    `Dependencies were installed for another operating system (${foreignPackages.map(({ name }) => name).join(', ')}). ` +
      'Remove the copied node_modules directories and run npm ci on this computer.',
  )
}

if (nativePackages.length && !currentPackages.length) {
  errors.push(`Native dependencies for ${process.platform} are missing; run npm ci on this computer.`)
}

console.log(`Platform: ${process.platform} ${process.arch}`)
console.log(`Node.js: ${process.versions.node}`)

if (errors.length) {
  for (const error of errors) console.error(`Environment error: ${error}`)
  process.exitCode = 1
} else {
  console.log('Development environment looks ready.')
}

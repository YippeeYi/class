import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

const dist = path.resolve('frontend/dist')
const index = await readFile(path.join(dist, 'index.html'), 'utf8')
assert.match(index, /src="\/class\/assets\//, 'build with GITHUB_ACTIONS=true GITHUB_REPOSITORY=yippeeyi/class')
const source = await readFile('frontend/src/lib/app-route.ts', 'utf8')
const routes = [...source.matchAll(/^  '(\/[^']*)',/gm)].map((match) => match[1])
assert.ok(routes.includes('/qb'))
for (const route of [...routes, '/auth', '/404']) {
  const entry = await readFile(path.join(dist, route, 'index.html'), 'utf8')
  assert.equal(entry, index, `${route} must contain only the shared application shell`)
}
assert.equal(await readFile(path.join(dist, '404.html'), 'utf8'), index)
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  try {
    assert.ok(url.pathname.startsWith('/class/'))
    let file = path.join(dist, url.pathname.slice('/class/'.length))
    const info = await stat(file)
    if (info.isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        response.writeHead(301, { location: `${url.pathname}/${url.search}` }).end()
        return
      }
      file = path.join(file, 'index.html')
    }
    response.writeHead(200).end(await readFile(file))
  } catch {
    response.writeHead(404).end(await readFile(path.join(dist, '404.html')))
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
try {
  const origin = `http://127.0.0.1:${server.address().port}`
  for (const route of [...routes, '/auth', '/404']) {
    for (const suffix of ['', route === '/' ? '?test=1' : '/?test=1']) {
      const response = await fetch(`${origin}/class${route}${suffix}`)
      assert.equal(response.status, 200, route + suffix)
      assert.equal(await response.text(), index)
    }
  }
  const redirect = await fetch(`${origin}/class/qb?test=1`, { redirect: 'manual' })
  assert.equal(redirect.status, 301)
  assert.equal(redirect.headers.get('location'), '/class/qb/?test=1')
  for (const match of index.matchAll(/(?:src|href)="(\/class\/[^"?#]+)"/g)) {
    assert.equal((await fetch(origin + match[1])).status, 200, match[1])
  }
  assert.equal((await fetch(`${origin}/class/unknown`)).status, 404)
  console.log('Pages artifact passed: /class base, every route entry, QB direct navigation/refresh, query-preserving directory redirects, public assets and 404 fallback.')
} finally {
  await new Promise((resolve) => server.close(resolve))
}

import { access } from 'node:fs/promises'

const candidates = {
  win32: [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ],
  darwin: [
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ],
  linux: ['/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium'],
}

export async function findSystemChromium() {
  if (process.env.CI) return undefined
  for (const candidate of candidates[process.platform] || []) {
    if (await access(candidate).then(() => true, () => false)) return candidate
  }
  return undefined
}

/**
 * Public-display profanity vocabulary. Keep phrases unique and ordered by intent;
 * the matcher sorts by length so a longer expression is replaced as one unit.
 * Matching is applied only to parsed human-readable text nodes, never raw markup.
 */
export const PROFANITY_TERMS = [
  '操你妈妈',
  '操你麻麻',
  '操你妈',
  '操你麻',
  '全家死完',
  '狗改不了吃屎',
  '狗改不了吃石',
  '小逼崽子',
  '小biē三',
  '小瘪三',
  '小比阳',
  '有出生无木',
  '你妈的',
  '他妈的',
  '妈妈的',
  '妈的',
  '放鸡巴屁',
  '放几把屁',
  '放几吧屁',
  '大出生',
  '十分出生',
  '化身为出生',
  '吾为出生',
  '出生想屌毛',
  '畜生',
  '我操',
  '卧槽',
  '我靠',
  '我艹',
  '我肏',
  '肏',
  '艹',
  '鸡巴',
  '几把',
  '几吧',
  '牛逼',
  '牛比',
  '傻逼',
  '煞笔',
  '啥笔',
  '弱智',
  '废物',
  '吃屎',
  '拉完屎',
  '拉屎',
  '鸡屎',
  '之屎',
  '吃石',
  '屁眼',
  '屌丝',
  '屌毛',
  '屌头',
  '屌',
  'b 破事',
  '你妈',
  '没母',
] as const

export const PROFANITY_LATIN_TOKENS = [
  'motherfucker',
  'fucking',
  'fucked',
  'bitch',
  'pussy',
  'dick',
  'cock',
  'fuck',
  'shit',
  'csndm',
  'nmsl',
  'tmd',
  'nmd',
  'md',
  'cnm',
  'djb',
  'zz',
  'byd',
  'sb',
  'tm',
  'jb',
  'fw',
  'sm',
  'nb',
] as const

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const phrasePattern = [...new Set(PROFANITY_TERMS)]
  .sort((left, right) => right.length - left.length)
  .map(escapeRegExp)
  .join('|')
const latinPattern = [...new Set(PROFANITY_LATIN_TOKENS)]
  .sort((left, right) => right.length - left.length)
  .map(escapeRegExp)
  .join('|')
const profanityPattern = new RegExp(
  `(?:${phrasePattern})|(?<![a-z0-9])(?:${latinPattern})(?![a-z0-9])`,
  'giu',
)

export function filterProfanity(value: string, enabled = true) {
  return enabled ? value.replace(profanityPattern, '***') : value
}

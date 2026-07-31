export type Attachment = { file: string; name?: string }

export type RecordItem = {
  id: string
  fileName: string
  recordIndex: number
  date: string
  time: string
  author: string
  recorder: string
  content: string
  text: string
  importance: string
  attachments: Attachment[]
  hidden: boolean
  imagePath?: string
  recordType?: 'record' | 'message' | 'supplement'
  [key: string]: unknown
}

export type Person = {
  id: string
  name: string
  alias: string
  aliases: string[]
  role: 'student' | 'teacher' | 'other' | string
  subject: string
  main: boolean
  bio: string
  avatarUrl: string
  [key: string]: unknown
}

export type Quote = {
  id: string
  quote: string
  content: string
  recordFile: string
  sourceDate: string
}

export type Material = {
  id: string
  title: string
  content: string
  [key: string]: unknown
}

export type QuizQuestion = {
  id: string
  contentKey: string
  contentKeys: string[]
  type: 'choice' | 'fill' | 'judge' | string
  prompt: string
  choices: string[]
  answer: string
  explanation: string
  image: string
  imageVersion: string
  [key: string]: unknown
}

export type CreditsPage = {
  id: string
  title: string
  sections: Array<{ id: string; title: string; members: string[] }>
  thanks: string[]
  originalImages: Array<{ id: string; title: string; content: string }>
  updatedAt: string
}

export type RecordPage = {
  page: string
  startFile: string
  endFile: string
  imagePath: string
  hidden: boolean
  [key: string]: unknown
}

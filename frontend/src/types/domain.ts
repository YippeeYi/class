export type Attachment = { file: string; name?: string }

export type RecordItem = {
  id: string
  fileName: string
  recordIndex: number
  date: string
  time: string
  author: string
  content: string
  importance: string
  attachments: Attachment[]
  hidden: boolean
  annotation?: string
  page?: string
  supplementIndex?: number
  imagePath?: string
  recordType?: 'record' | 'message' | 'supplement'
}

export type Person = {
  id: string
  name: string
  alias: string
  aliases: string[]
  role: string
  subject: string
  main: boolean
  bio: string
  avatarUrl: string
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
}

export type PageMessage = {
  hidden?: boolean
  page: string
  content: string
  author: string
  annotation?: string
}

export type PageSupplement = {
  hidden?: boolean
  id: string
  fileName: string
  page: string
  supplementIndex: number
  author: string
  content: string
  importance: string
  date: string
  time: string
  annotation?: string
}

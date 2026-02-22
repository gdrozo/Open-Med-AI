import Database from '@tauri-apps/plugin-sql'
import { ChatMessage } from './coms'

let db: Database | null = null

// image_path is optional
export const CHAT_SCHEMA = `
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      image_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `

export const MESSAGE_SCHEMA = `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER,
      role TEXT,
      content TEXT,
      folder TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
    )
  `

export async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:chats.db')
  }
  return db
}

export async function initDb() {
  const database = await getDb()
  await database.execute(CHAT_SCHEMA)
  await database.execute(MESSAGE_SCHEMA)
}

export async function createChat(
  title: string,
  imagePath: string = '',
): Promise<number> {
  const database = await getDb()
  const result = await database.execute(
    'INSERT INTO chats (title, image_path) VALUES (?, ?)',
    [title, imagePath],
  )
  if (result.lastInsertId === undefined) {
    throw new Error('Failed to create chat: no insert ID returned.')
  }
  return result.lastInsertId
}

export async function saveMessage(chatId: number, message: ChatMessage) {
  const database = await getDb()
  await database.execute(
    'INSERT INTO messages (chat_id, role, content, folder) VALUES (?, ?, ?, ?)',
    [
      chatId,
      message.role,
      message.content,
      JSON.stringify(message.folder || ''),
    ],
  )
}

export async function getChats() {
  const database = await getDb()
  return await database.select<
    { id: number; title: string; created_at: string }[]
  >('SELECT * FROM chats ORDER BY created_at DESC')
}

export async function getMessages(chatId: number): Promise<ChatMessage[]> {
  const database = await getDb()
  const rows = await database.select<
    { role: string; content: string; folder: string }[]
  >(
    'SELECT role, content, folder FROM messages WHERE chat_id = ? ORDER BY id ASC',
    [chatId],
  )
  return rows.map(row => ({
    role: row.role as 'user' | 'assistant',
    content: row.content,
    folder: JSON.parse(row.folder),
  }))
}

export async function getChatImage(chatId: number): Promise<string> {
  const database = await getDb()
  const row = await database.select<
    {
      image_path: string
    }[]
  >(`SELECT image_path FROM chats WHERE id = ?`, [chatId])
  return row[0].image_path
}

export async function getChat(chatId: number): Promise<{
  id: number
  title: string
  image_path: string
  created_at: string
}> {
  const database = await getDb()
  const rows = await database.select<
    {
      id: number
      title: string
      image_path: string
      created_at: string
    }[]
  >(`SELECT * FROM chats WHERE id = ?`, [chatId])
  return rows[0]
}

export async function updateChatTitle(chatId: number, title: string) {
  const database = await getDb()
  await database.execute('UPDATE chats SET title = ? WHERE id = ?', [
    title,
    chatId,
  ])
}

export async function updateChatImage(chatId: number, imagePath: string) {
  const database = await getDb()
  await database.execute('UPDATE chats SET image_path = ? WHERE id = ?', [
    imagePath,
    chatId,
  ])
}

export async function deleteChat(chatId: number) {
  const database = await getDb()
  await database.execute('DELETE FROM chats WHERE id = ?', [chatId])
}

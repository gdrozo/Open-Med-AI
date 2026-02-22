import { getDb, MESSAGE_SCHEMA, CHAT_SCHEMA } from './db'

export async function migrateDb() {
  const database = await getDb()

  //Delete all data from the database
  await database.execute(`DELETE FROM messages`)
  await database.execute(`DELETE FROM chats`)

  // Drop the existing messages table
  await database.execute(`DROP TABLE IF EXISTS messages`)

  // Drop the existing chats table
  await database.execute(`DROP TABLE IF EXISTS chats`)

  // Create the messages table with the new schema
  await database.execute(MESSAGE_SCHEMA)

  // Create the chats table with the new schema
  await database.execute(CHAT_SCHEMA)
  console.log('Database migration complete: messages table updated.')
}

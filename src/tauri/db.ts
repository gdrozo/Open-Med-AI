import { ChatMessage } from './coms'

export type Workflow = {
  id: number
  name: string
  required_context: 'none' | 'files' | 'image' | 'any'
  created_at: string
}

export type WorkflowStep = {
  id: number
  workflow_id: number
  prompt: string
  step_order: number
}

const RUST_SERVER_URL = 'http://127.0.0.1:8001/db'

export async function initDb() {
  // Database and tables are created automatically on Rust backend startup
}

export async function createChat(
  title: string,
  imagePath: string = '',
): Promise<number> {
  const response = await fetch(`${RUST_SERVER_URL}/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, image_path: imagePath }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create chat: ${error}`)
  }
  return await response.json()
}

export async function saveMessage(
  chatId: number,
  message: ChatMessage,
): Promise<number> {
  const response = await fetch(`${RUST_SERVER_URL}/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: message.role,
      content: message.content,
      folder: message.folder || '',
    }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to save message: ${error}`)
  }
  return await response.json()
}

export async function updateMessage(messageId: number, content: string) {
  const response = await fetch(`${RUST_SERVER_URL}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update message: ${error}`)
  }
}

export async function getChats() {
  const response = await fetch(`${RUST_SERVER_URL}/chats`)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get chats: ${error}`)
  }
  return await response.json()
}

export async function getMessages(chatId: number): Promise<ChatMessage[]> {
  const response = await fetch(`${RUST_SERVER_URL}/chats/${chatId}/messages`)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get messages: ${error}`)
  }
  const messages = await response.json()
  return messages.map((row: any) => ({
    role: row.role as 'user' | 'assistant',
    content: row.content,
    folder: row.folder,
  }))
}

export async function getChat(chatId: number): Promise<{
  id: number
  title: string
  image_path: string
  created_at: string
}> {
  const response = await fetch(`${RUST_SERVER_URL}/chats/${chatId}`)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get chat: ${error}`)
  }
  return await response.json()
}

export async function getChatImage(chatId: number): Promise<string> {
  const chat = await getChat(chatId)
  return chat.image_path
}

export async function updateChatTitle(chatId: number, title: string) {
  const response = await fetch(`${RUST_SERVER_URL}/chats/${chatId}/title`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update chat title: ${error}`)
  }
}

export async function updateChatImage(chatId: number, imagePath: string) {
  const response = await fetch(`${RUST_SERVER_URL}/chats/${chatId}/image`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_path: imagePath }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update chat image: ${error}`)
  }
}

export async function deleteChat(chatId: number) {
  const response = await fetch(`${RUST_SERVER_URL}/chats/${chatId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to delete chat: ${error}`)
  }
}

// Workflows
export async function getWorkflows(): Promise<Workflow[]> {
  const response = await fetch(`${RUST_SERVER_URL}/workflows`)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get workflows: ${error}`)
  }
  return await response.json()
}

export async function createWorkflow(
  name: string,
  requiredContext: string = 'none',
): Promise<number> {
  const response = await fetch(`${RUST_SERVER_URL}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, required_context: requiredContext }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create workflow: ${error}`)
  }
  return await response.json()
}

export async function deleteWorkflow(id: number) {
  const response = await fetch(`${RUST_SERVER_URL}/workflows/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to delete workflow: ${error}`)
  }
}

export async function getWorkflowSteps(id: number): Promise<WorkflowStep[]> {
  const response = await fetch(`${RUST_SERVER_URL}/workflows/${id}/steps`)
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get workflow steps: ${error}`)
  }
  return await response.json()
}

export async function updateWorkflowSteps(
  id: number,
  steps: { prompt: string; step_order: number }[],
) {
  const response = await fetch(`${RUST_SERVER_URL}/workflows/${id}/steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steps }),
  })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to update workflow steps: ${error}`)
  }
}

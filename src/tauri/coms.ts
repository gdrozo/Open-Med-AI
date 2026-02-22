// import { invoke } from '@tauri-apps/api/core'

export type ChatImage = {
  data?: string
  path?: string
}

export function convertAssetUrl(path: string) {
  return `http://127.0.0.1:8001/asset?path=${encodeURIComponent(path)}`
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  folder?: string
}

const DEFAULT_PYTHON_SERVER_URL = 'http://127.0.0.1:8000/'

export function getPythonServerUrl() {
  const saved = localStorage.getItem('PYTHON_SERVER_URL')
  if (saved) return saved
  localStorage.setItem('PYTHON_SERVER_URL', DEFAULT_PYTHON_SERVER_URL)
  return DEFAULT_PYTHON_SERVER_URL
}

export let PYTHON_SERVER_URL = getPythonServerUrl()

export function setPythonServerUrl(url: string) {
  PYTHON_SERVER_URL = url.endsWith('/') ? url : `${url}/`
  localStorage.setItem('PYTHON_SERVER_URL', PYTHON_SERVER_URL)
}

export async function callToGenerate(
  history: ChatMessage[],
  onChunk: (chunk: string, generationId?: string) => void,
  chatId: number,
  image?: ChatImage,
) {
  const API_URL = `${PYTHON_SERVER_URL}generate`

  const formData = new FormData()

  history.forEach(msg => {
    const apiMsg: any = {
      role: msg.role,
      content: msg.content,
    }
    if (msg.folder) {
      apiMsg.paths = [msg.folder]
    }

    formData.append('history', JSON.stringify(apiMsg))
  })

  // Append the determined image_base64 data (or empty string) once
  formData.append('image_path', image?.path || '')
  formData.append('chat_id', chatId.toString())

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`,
      )
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Failed to get readable stream from response.')

    let previousTextChunk = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += new TextDecoder().decode(value)

      while (buffer.includes('\n')) {
        const lineEnd = buffer.indexOf('\n')
        const line = buffer.substring(0, lineEnd).trim()
        buffer = buffer.substring(lineEnd + 1)

        if (line.startsWith('data:')) {
          try {
            const jsonStr = line.substring(len('data:')).trim()
            const json_data = JSON.parse(jsonStr)
            const msgType = json_data.type
            const generationId = json_data.generation_id

            if (
              msgType === 'update' ||
              (msgType === undefined && 'text' in json_data)
            ) {
              if ('text' in json_data) {
                const currentText = json_data.text
                if (currentText.length > previousTextChunk.length) {
                  const newPart = currentText.substring(
                    previousTextChunk.length,
                  )
                  onChunk(newPart, generationId)
                  previousTextChunk = currentText
                }
              }
            } else if (msgType === 'complete') {
              // Generation complete, no action needed for onChunk, but can be used to signal completion
              console.log('--- Generation Complete ---')
            } else if (msgType === 'error') {
              console.error(`Error from server: ${json_data.message}`)
              throw new Error(`Server error: ${json_data.message}`)
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e)
          }
        }
      }
    }
    onChunk('', 'complete') // Signal completion to the UI
  } catch (error) {
    console.error('Request failed:', error)
    onChunk('', 'error') // Signal error to the UI
    throw error
  }
}

export async function cancelGeneration(id: string) {
  console.log('Cancelling generation with ID:', id)
  try {
    const response = await fetch(`${PYTHON_SERVER_URL}cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ generation_id: id }),
    })
    if (response.ok) {
      console.log('Generation cancelled successfully.')
      return true
    } else {
      console.error('Failed to cancel generation:', response.statusText)
      return false
    }
  } catch (error) {
    console.error('Error cancelling generation:', error)
    return false
  }
}

export async function storeBlobImage(blob: Blob): Promise<string | null> {
  try {
    const response = await fetch('http://127.0.0.1:8001/store-blob-image', {
      method: 'POST',
      body: blob,
    })
    if (response.ok) {
      const fileName = await response.text()
      console.log('Image stored successfully as:', fileName)
      return fileName
    } else {
      console.error('Failed to store image.')
      return null
    }
  } catch (error) {
    console.error('Error storing image:', error)
    return null
  }
}

// Helper function equivalent to Python's len() for string
function len(str: string) {
  return str.length
}

export async function checkAIServer() {
  try {
    const response = await fetch(PYTHON_SERVER_URL)
    return response.ok
  } catch (error) {
    return false
  }
}

export async function startPythonServer(onConsole?: (msg: string) => void) {
  return new Promise<void>((resolve, reject) => {
    const eventSource = new EventSource('http://127.0.0.1:8001/start')

    eventSource.onmessage = event => {
      const msg = event.data
      if (onConsole) {
        onConsole(msg)
      }
      // If the message indicates the server is ready, we can resolve
      if (msg.includes('Uvicorn running on')) {
        resolve()
      }
    }

    eventSource.onerror = error => {
      console.error('EventSource failed:', error)
      eventSource.close()
      reject(new Error('Failed to start Python server'))
    }
  })
}

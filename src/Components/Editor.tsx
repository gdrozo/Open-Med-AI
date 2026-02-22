import { createSignal, onMount, Show } from 'solid-js'
import { Zap } from 'lucide-solid'
import {
  callToGenerate,
  ChatMessage,
  ChatImage,
  cancelGeneration,
  storeBlobImage,
} from '../tauri/coms'
import SideBar from './SideBar'
import MessageList from './MessageList'
import ChatInput from './ChatInput'
import ResponseDisplay from './ResponseDisplay'
import WorkflowEditor from './WorkflowEditor'
import { open } from '@tauri-apps/plugin-dialog'
import { readTextFile } from '@tauri-apps/plugin-fs'
import {
  getChats,
  getMessages,
  createChat,
  saveMessage,
  deleteChat as dbDeleteChat,
  getChatImage,
  getChat,
  getWorkflows,
  createWorkflow,
  deleteWorkflow,
  getWorkflowSteps,
  updateWorkflowSteps,
  Workflow,
  WorkflowStep,
} from '../tauri/db'
import { migrateDb } from '../tauri/migrate_db'

type ChatHistory = ChatMessage[]

export default function Editor() {
  //migrateDb()

  let textArea: HTMLTextAreaElement | undefined

  const [response, setResponse] = createSignal('')
  const [chat, setChat] = createSignal<ChatHistory>([])
  const [currentInput, setCurrentInput] = createSignal('')
  const [startingState, setStartingState] = createSignal(true)
  const [image, setImage] = createSignal<ChatImage>()
  const [imageBlob, setImageBlob] = createSignal<Blob>()
  const [textFiles, setTextFiles] = createSignal<
    { name: string; content: string }[]
  >([])
  const [selectedFolders, setSelectedFolders] = createSignal<string[]>([])

  const [currentChatId, setCurrentChatId] = createSignal<number | null>(null)
  const [historyList, setHistoryList] = createSignal<
    { id: number; title: string; created_at: string }[]
  >([])

  const [isGenerating, setIsGenerating] = createSignal(false)
  const [generationId, setGenerationId] = createSignal<string | null>(null)

  const [workflows, setWorkflows] = createSignal<Workflow[]>([])
  const [activeWorkflowId, setActiveWorkflowId] = createSignal<number | null>(
    null,
  )
  const [isWorkflowEditorOpen, setIsWorkflowEditorOpen] = createSignal(false)
  const [editingWorkflowId, setEditingWorkflowId] = createSignal<number | null>(
    null,
  )

  const [activeWorkflowSteps, setActiveWorkflowSteps] = createSignal<
    WorkflowStep[]
  >([])
  const [currentWorkflowStepIndex, setCurrentWorkflowStepIndex] =
    createSignal(-1)
  const [isAutoRunEnabled, setIsAutoRunEnabled] = createSignal(false)

  onMount(async () => {
    refreshHistory()
    refreshWorkflows()
  })

  async function refreshWorkflows() {
    const list = await getWorkflows()
    setWorkflows(list)
  }

  async function refreshHistory() {
    const list = await getChats()
    setHistoryList(list)
  }

  async function loadChat(id: number) {
    const messages = await getMessages(id)
    const imagePath = await getChatImage(id)

    setImage()
    setImageBlob()
    setTextFiles([])
    setSelectedFolders([])

    console.log('imagePath', imagePath)

    if (imagePath) setImage({ path: imagePath })
    setChat(messages)
    setCurrentChatId(id)
    setStartingState(false)
    if (messages.length > 0) {
      setResponse(messages[messages.length - 1].content)
    } else {
      setResponse('')
    }
  }

  async function createNewChat() {
    setImage()
    setImageBlob()
    setTextFiles([])
    setSelectedFolders([])
    setChat([])
    setCurrentChatId(null)
    setStartingState(true)
    setResponse('')
  }

  async function deleteChat(id: number) {
    await dbDeleteChat(id)
    if (currentChatId() === id) {
      createNewChat()
    }
    refreshHistory()
  }

  function handleEditWorkflow(id: number) {
    setEditingWorkflowId(id)
    setIsWorkflowEditorOpen(true)
  }

  function handleCreateWorkflow() {
    setEditingWorkflowId(null)
    setIsWorkflowEditorOpen(true)
  }

  async function handleDeleteWorkflow(id: number) {
    await deleteWorkflow(id)
    refreshWorkflows()
    if (activeWorkflowId() === id) {
      setActiveWorkflowId(null)
      setActiveWorkflowSteps([])
      setCurrentWorkflowStepIndex(-1)
    }
  }

  async function handleSaveWorkflow(
    name: string,
    requiredContext: string,
    steps: { prompt: string; step_order: number }[],
  ) {
    let id = editingWorkflowId()
    if (id === null) {
      id = await createWorkflow(name, requiredContext)
    }
    await updateWorkflowSteps(id, steps)
    setIsWorkflowEditorOpen(false)
    refreshWorkflows()
  }

  async function handleSelectWorkflow(id: number) {
    if (activeWorkflowId() === id) {
      setActiveWorkflowId(null)
      setActiveWorkflowSteps([])
      setCurrentWorkflowStepIndex(-1)
      setIsAutoRunEnabled(false)
    } else {
      const wf = workflows().find(w => w.id === id)
      if (!wf) return

      setActiveWorkflowId(id)
      const steps = await getWorkflowSteps(id)
      setActiveWorkflowSteps(steps)

      if (steps.length > 0) {
        setCurrentWorkflowStepIndex(0)
        // Context check
        const hasFiles = textFiles().length > 0 || selectedFolders().length > 0
        const hasImage = image() !== undefined

        let contextOk = true
        if (wf.required_context === 'files' && !hasFiles) contextOk = false
        if (wf.required_context === 'image' && !hasImage) contextOk = false
        if (wf.required_context === 'any' && !hasFiles && !hasImage)
          contextOk = false

        if (contextOk) {
          setCurrentInput(steps[0].prompt)
        } else {
          setCurrentInput('')
        }
      }
    }
  }

  function skipWorkflowStep() {
    const nextIndex = currentWorkflowStepIndex() + 1
    if (nextIndex < activeWorkflowSteps().length) {
      setCurrentWorkflowStepIndex(nextIndex)
      setCurrentInput(activeWorkflowSteps()[nextIndex].prompt)
    } else {
      // Workflow finished
      setActiveWorkflowId(null)
      setActiveWorkflowSteps([])
      setCurrentWorkflowStepIndex(-1)
    }
  }

  async function send() {
    const cm = currentInput().trim()
    if (
      !cm &&
      image()?.path === null &&
      textFiles().length === 0 &&
      selectedFolders().length === 0
    )
      return

    let selectedImage = image()
    const selectedTextFiles = textFiles()
    const folderPaths = selectedFolders()

    //setImage()
    const blob = imageBlob()
    if (blob) {
      try {
        const newImagePath = await storeBlobImage(blob)
        if (newImagePath === null) return
        const pathImage: ChatImage = { path: newImagePath }
        setImage(pathImage)
        selectedImage = pathImage
        setImageBlob()
      } catch (error) {
        console.error('Error storing image:', error)
        return
      }
    }
    setTextFiles([])
    setSelectedFolders([])
    setCurrentInput('')
    if (textArea) textArea.value = ''

    // Construct content with text file attachments if any
    let finalContent = cm
    if (selectedTextFiles.length > 0) {
      const attachmentsString = selectedTextFiles
        .map(tf => `--- File: ${tf.name} ---\n${tf.content}\n--- End File ---`)
        .join('\n\n')
      finalContent = cm ? `${cm}\n\n${attachmentsString}` : attachmentsString
    }

    // Add folder paths to the content
    /*if (folderPaths.length > 0) {
      const folderAttachmentsString = folderPaths
        .map(folderPath => `--- Folder: ${folderPath} ---`)
        .join('\n\n')
      finalContent = finalContent ? `${finalContent}\n\n${folderAttachmentsString}` : folderAttachmentsString
    }*/

    const userMessage: ChatMessage = {
      role: 'user',
      content: finalContent,
      folder: folderPaths[0],
    }

    let chatId = currentChatId()
    if (chatId === null) {
      const title = userMessage.content.slice(0, 30) || 'New Chat'
      chatId = await createChat(title, selectedImage?.path || '')
      setCurrentChatId(chatId)
      refreshHistory()
    }

    await saveMessage(chatId!, userMessage)
    const updatedHistory = [...chat(), userMessage]

    const assistantMessage: ChatMessage = { role: 'assistant', content: '' }
    setChat([...updatedHistory, assistantMessage])

    setStartingState(false)
    console.log('Generating')
    setIsGenerating(true)

    let accumulatedResponse = ''
    try {
      await callToGenerate(
        updatedHistory,
        (chunk, id) => {
          //console.log('Chunk:', chunk)
          console.log('ID:', id)
          if (id) setGenerationId(id)
          accumulatedResponse += chunk
          setResponse(accumulatedResponse)

          setChat(prev => {
            const next = [...prev]
            if (next.length > 0) {
              const last = next[next.length - 1]
              next[next.length - 1] = { ...last, content: accumulatedResponse }
            }
            return next
          })
        },
        chatId!,
        selectedImage,
      )
    } catch (error) {
      console.error('Error during generation:', error)
    } finally {
      console.log('Generation finished')
      setIsGenerating(false)
      setGenerationId(null)

      // Automatically prep next step if in a workflow
      if (activeWorkflowId() !== null) {
        // We don't auto-send, but we prep the input or show a suggestion
        // Let's increment index so the UI can show the next prompt
        const nextIndex = currentWorkflowStepIndex() + 1
        if (nextIndex < activeWorkflowSteps().length) {
          setCurrentWorkflowStepIndex(nextIndex)
          const nextPrompt = activeWorkflowSteps()[nextIndex].prompt

          if (isAutoRunEnabled()) {
            setCurrentInput(nextPrompt)
            setTimeout(() => {
              if (activeWorkflowId() !== null && isAutoRunEnabled()) {
                send()
              }
            }, 2000)
          }
        } else {
          // Completed
          setActiveWorkflowId(null)
          setActiveWorkflowSteps([])
          setCurrentWorkflowStepIndex(-1)
          setIsAutoRunEnabled(false)
        }
      }
    }
  }

  async function onCancel(id: string) {
    console.log('Cancelling generation with ID:', id)
    try {
      const success = await cancelGeneration(id)
      if (success) {
        setIsGenerating(false)
        setGenerationId(null)
      }
    } catch (error) {
      console.error('Error during cancellation:', error)
    }
  }

  function onInput(e: Event) {
    const target = e.target as HTMLTextAreaElement
    setCurrentInput(target.value)
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile()
          if (blob) {
            const reader = new FileReader()
            reader.onload = re => {
              const base64 = re.target?.result as string
              setImage({ data: base64 })
              setImageBlob(blob)
            }
            reader.readAsDataURL(blob)
          }
        }
      }
    }
  }

  async function handleFileSelect() {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'All Supported',
            extensions: [
              'png',
              'jpg',
              'jpeg',
              'gif',
              'webp',
              'bmp',
              'txt',
              'md',
              'py',
              'js',
              'ts',
              'tsx',
              'json',
              'rs',
              'html',
              'css',
              'java',
              'c',
              'cpp',
              'h',
              'hpp',
              'yaml',
              'yml',
              'toml',
              'sql',
            ],
          },
          {
            name: 'Image',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'],
          },
          {
            name: 'Text',
            extensions: [
              'txt',
              'md',
              'py',
              'js',
              'ts',
              'tsx',
              'json',
              'rs',
              'html',
              'css',
              'java',
              'c',
              'cpp',
              'h',
              'hpp',
              'yaml',
              'yml',
              'toml',
              'sql',
            ],
          },
        ],
      })

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected]

        for (const path of paths) {
          const lowerPath = path.toLowerCase()
          const isImage = [
            '.png',
            '.jpg',
            '.jpeg',
            '.gif',
            '.webp',
            '.bmp',
          ].some(ext => lowerPath.endsWith(ext))

          if (isImage) {
            setImage({ path })
            setImageBlob()
          } else {
            try {
              const content = await readTextFile(path)
              const name = path.split(/[/\\]/).pop() || path
              setTextFiles(prev => [...prev, { name, content }])
            } catch (err) {
              console.error(`Failed to read text file at ${path}:`, err)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error selecting files:', error)
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault()
    const files = e.dataTransfer?.files
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onload = re => {
            const base64 = re.target?.result as string
            setImage({ data: base64 })
            setImageBlob(file)
          }
          reader.readAsDataURL(file)
        } else {
          // Try to read as text for other file types
          const reader = new FileReader()
          reader.onload = re => {
            const content = re.target?.result as string
            setTextFiles(prev => [...prev, { name: file.name, content }])
          }
          reader.readAsText(file)
        }
      }
    }
  }

  function removeImage() {
    setImage()
    setImageBlob()
  }

  function removeTextFile(index: number) {
    setTextFiles(prev => prev.filter((_, i) => i !== index))
  }

  function removeFolder(index: number) {
    setSelectedFolders(prev => prev.filter((_, i) => i !== index))
  }

  async function handleImageSelect() {
    try {
      const selected = await open({
        multiple: false, // Only allow selecting a single image
        filters: [
          {
            name: 'Image',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'],
          },
        ],
      })

      if (selected && typeof selected === 'string') {
        // If an image is selected, replace any existing images with the new one
        setImage({ path: selected })
        setImageBlob()
      }
    } catch (error) {
      console.error('Error selecting image:', error)
    }
  }

  async function handleFolderSelect() {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
      })

      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected]
        setSelectedFolders(prev => [...prev, ...paths])
      }
    } catch (error) {
      console.error('Error selecting folder:', error)
    }
  }

  return (
    <div
      class='flex h-full w-full overflow-hidden bg-main'
      data-starting-state={startingState()}
    >
      <SideBar
        historyList={historyList()}
        workflows={workflows()}
        currentChatId={currentChatId()}
        activeWorkflowId={activeWorkflowId()}
        onNewChat={createNewChat}
        onLoadChat={loadChat}
        onDeleteChat={deleteChat}
        onSelectWorkflow={handleSelectWorkflow}
        onEditWorkflow={handleEditWorkflow}
        onCreateWorkflow={handleCreateWorkflow}
        onDeleteWorkflow={handleDeleteWorkflow}
      />

      {/* Main Content */}
      <div
        class={`grow px-4 relative flex overflow-hidden  ${startingState() ? 'flex-col items-center justify-center' : 'h-full w-full'}`}
        data-response={response()}
      >
        <Show when={activeWorkflowId() !== null}>
          <div class='absolute top-4 left-0 right-0 z-10 p-2 flex justify-center pointer-events-none'>
            <div class='bg-secondary/80 backdrop-blur-md border border-[#333] rounded-full px-4 py-1.5 flex items-center gap-4 shadow-xl pointer-events-auto animate-in fade-in slide-in-from-top-2'>
              <div class='flex items-center gap-2'>
                <Zap size={14} class='text-yellow-400' />
                <span class='text-xs font-medium text-main'>
                  {workflows().find(w => w.id === activeWorkflowId())?.name}
                </span>
              </div>
              <div class='h-3 w-px bg-[#333]' />
              <span class='text-[10px] text-gray-400 uppercase tracking-wider'>
                Step {currentWorkflowStepIndex() + 1} /{' '}
                {activeWorkflowSteps().length}
              </span>
              <div class='h-3 w-px bg-[#333]' />

              <label class='flex items-center gap-2 cursor-pointer group'>
                <div class='relative'>
                  <input
                    type='checkbox'
                    class='sr-only'
                    checked={isAutoRunEnabled()}
                    onchange={e => setIsAutoRunEnabled(e.currentTarget.checked)}
                  />
                  <div
                    class={`w-7 h-4 rounded-full transition-colors ${isAutoRunEnabled() ? 'bg-blue-600' : 'bg-[#333]'}`}
                  />
                  <div
                    class={`absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isAutoRunEnabled() ? 'translate-x-3' : 'translate-x-0'}`}
                  />
                </div>
                <span class='text-[10px] text-gray-400 group-hover:text-main uppercase tracking-wider font-bold transition-colors'>
                  Auto-run
                </span>
              </label>

              <div class='h-3 w-px bg-[#333]' />
              <button
                onclick={() => {
                  setActiveWorkflowId(null)
                  setActiveWorkflowSteps([])
                  setCurrentWorkflowStepIndex(-1)
                  setIsAutoRunEnabled(false)
                }}
                class='text-[10px] text-red-400 hover:text-red-300 font-bold uppercase transition-colors'
              >
                Exit
              </button>
            </div>
          </div>
        </Show>

        <ResponseDisplay response={response} startingState={startingState} />

        <div
          class={`flex flex-col justify-end gap-3 ${startingState() ? 'w-full max-w-2xl' : 'py-4'}`}
        >
          <MessageList messages={chat()} onMessageClick={setResponse} />
          <Show when={activeWorkflowId() !== null && !isGenerating()}>
            {(() => {
              const wf = workflows().find(w => w.id === activeWorkflowId())
              const hasFiles =
                textFiles().length > 0 || selectedFolders().length > 0
              const hasImage = image() !== undefined
              let contextMissing = false
              if (wf?.required_context === 'files' && !hasFiles)
                contextMissing = true
              if (wf?.required_context === 'image' && !hasImage)
                contextMissing = true
              if (wf?.required_context === 'any' && !hasFiles && !hasImage)
                contextMissing = true

              return contextMissing ? (
                <div class='mb-2 bg-yellow-600 border border-yellow-500/30 text-yellow-300 text-sm px-3 py-1.5 rounded-lg flex items-center gap-2 animate-pulse w-fit self-center'>
                  <Zap size={12} class='text-yellow-500' />
                  Context Required: Please select {wf?.required_context} before
                  starting.
                </div>
              ) : null
            })()}
          </Show>
          <Show
            when={
              activeWorkflowId() !== null &&
              currentWorkflowStepIndex() !== -1 &&
              !isGenerating()
            }
          >
            <div class='flex items-center gap-2 animate-in slide-in-from-bottom-2'>
              <button
                onclick={() => {
                  setCurrentInput(
                    activeWorkflowSteps()[currentWorkflowStepIndex()].prompt,
                  )
                  send()
                }}
                class='bg-blue-600/20 border border-blue-500/30 text-blue-500 text-xs px-3 py-1.5 rounded-lg hover:bg-blue-600/30 transition-all flex items-center gap-2'
              >
                <Zap size={12} class='text-yellow-400' />
                Next Step:{' '}
                {activeWorkflowSteps()[currentWorkflowStepIndex()].prompt.slice(
                  0,
                  50,
                )}
                ...
              </button>
            </div>
          </Show>
          <ChatInput
            currentInput={currentInput()}
            onInput={onInput}
            onSend={send}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            image={image()}
            textFiles={textFiles()}
            selectedFolders={selectedFolders()}
            onRemoveImage={removeImage}
            onRemoveTextFile={removeTextFile}
            onRemoveFolder={removeFolder}
            onSelectFiles={handleFileSelect}
            onSelectFolder={handleFolderSelect}
            startingState={startingState()}
            textAreaRef={el => (textArea = el)}
            isGenerating={isGenerating()}
            generationId={generationId()}
            onCancel={onCancel}
            onSelectImages={handleImageSelect}
          />
        </div>
      </div>

      <Show when={isWorkflowEditorOpen()}>
        <WorkflowEditor
          workflowId={editingWorkflowId()}
          existingWorkflows={workflows()}
          onClose={() => setIsWorkflowEditorOpen(false)}
          onSave={handleSaveWorkflow}
        />
      </Show>
    </div>
  )
}

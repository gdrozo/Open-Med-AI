import { For, Show } from 'solid-js'
import { FileText, Paperclip, X, FolderPlus, Image } from 'lucide-solid'
import { ChatImage, convertAssetUrl } from '../tauri/coms'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'

interface ChatInputProps {
  currentInput: string
  onInput: (e: Event) => void
  onSend: () => void
  onPaste: (e: ClipboardEvent) => void
  onDrop: (e: DragEvent) => void
  onDragOver: (e: DragEvent) => void
  image?: ChatImage
  textFiles: { name: string; content: string }[]
  onRemoveImage: () => void
  onRemoveTextFile: (index: number) => void
  onSelectFiles: () => void
  onSelectFolder: () => void
  startingState: boolean
  textAreaRef?: (el: HTMLTextAreaElement) => void
  selectedFolders: string[]
  onRemoveFolder: (index: number) => void
  isGenerating: boolean
  generationId: string | null
  onCancel: (generationId: string) => void
  onSelectImages: () => void
}

export default function ChatInput(props: ChatInputProps) {
  useKeyboardShortcut('enter', () => props.onSend(), {
    ctrlKey: true,
  })

  return (
    <div
      class={`bg-secondary flex flex-col rounded-lg overflow-hidden ${props.startingState ? '' : 'min-w-72'}`}
    >
      <Show
        when={
          props.image?.data ||
          props.image?.path ||
          props.textFiles.length > 0 ||
          props.selectedFolders.length > 0
        }
      >
        <div class='flex gap-2 p-3 overflow-x-auto border-b border-[#333]'>
          <Show when={props.image}>
            <div class='relative min-w-15 h-15 group'>
              <img
                src={
                  props.image?.path
                    ? convertAssetUrl(props.image.path)
                    : props.image?.data
                }
                class='w-full h-full object-cover rounded-md border border-[#444]'
              />
              <button
                onclick={() => props.onRemoveImage()}
                class='absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity'
              >
                <X class='size-3 text-main' />
              </button>
            </div>
          </Show>
          <For each={props.textFiles}>
            {(file, index) => (
              <div class='relative min-w-25 h-15 bg-main rounded-md border border-[#444] p-2 flex items-center gap-2 group'>
                <FileText class='size-6 text-blue-400 shrink-0' />
                <div class='flex flex-col overflow-hidden'>
                  <span class='text-xs text-main truncate'>{file.name}</span>
                  <span class='text-[10px] text-gray-500'>
                    {file.content.length} chars
                  </span>
                </div>
                <button
                  onclick={() => props.onRemoveTextFile(index())}
                  class='absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity'
                >
                  <X class='size-3 text-main' />
                </button>
              </div>
            )}
          </For>
          <For each={props.selectedFolders}>
            {(folderPath, index) => (
              <div class='relative min-w-25 h-15 bg-main rounded-md border border-[#444] p-2 flex items-center gap-2 group'>
                <FolderPlus class='size-6 text-yellow-400 shrink-0' />
                <div class='flex flex-col overflow-hidden'>
                  <span class='text-xs text-main truncate'>
                    {folderPath.split(/[/\\]/).pop()}
                  </span>
                </div>
                <button
                  onclick={() => props.onRemoveFolder(index())}
                  class='absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity'
                >
                  <X class='size-3 text-main' />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>
      <textarea
        class={`bg-secondary p-3 outline-none ${props.startingState ? 'min-h-50 min-w-125' : 'min-h-37.5 min-w-75'}`}
        placeholder='Type your message here...'
        oninput={props.onInput}
        onpaste={props.onPaste}
        ondrop={props.onDrop}
        onDragOver={props.onDragOver}
        ref={props.textAreaRef}
      ></textarea>
      <div class='flex justify-between items-center px-3 py-1'>
        <div class='flex gap-2'>
          <button
            class='p-2 hover:bg-highlight rounded-lg text-gray-400 hover:text-main transition-colors'
            onclick={props.onSelectFiles}
          >
            <Paperclip class='size-5' />
          </button>
          <button
            class='p-2 hover:bg-highlight rounded-lg text-gray-400 hover:text-main transition-colors'
            onclick={props.onSelectImages}
          >
            <Image class='size-5' />
          </button>
          <button
            class='p-2 hover:bg-highlight rounded-lg text-gray-400 hover:text-main transition-colors'
            onclick={props.onSelectFolder}
          >
            <FolderPlus class='size-5' />
          </button>
        </div>
        <Show when={!props.isGenerating && !props.generationId}>
          <button
            class='focus-within:bg-highlight hover:bg-highlight outline-none px-4 py-1.5 rounded-lg font-medium transition-colors'
            onclick={props.onSend}
          >
            Send
          </button>
        </Show>
        <Show when={props.isGenerating && props.generationId}>
          <button
            class='focus-within:bg-red-700 hover:bg-red-600 outline-none px-4 py-1.5 rounded-lg font-medium transition-colors bg-red-500 text-main'
            onclick={() =>
              props.generationId && props.onCancel(props.generationId)
            }
          >
            Stop
          </button>
        </Show>
      </div>
    </div>
  )
}

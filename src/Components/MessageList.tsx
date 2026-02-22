import { For, Show } from 'solid-js'
import { ArrowLeft } from 'lucide-solid'
import { ChatMessage } from '../tauri/coms'
import SolidMarkdown from '../Generics/SolidMarkdown'

interface MessageListProps {
  messages: ChatMessage[]
  onMessageClick: (content: string) => void
}

export default function MessageList(props: MessageListProps) {
  return (
    <div class='max-h-[calc(100%-14.6rem)] overflow-y-auto'>
      <For each={props.messages}>
        {message => (
          <>
            <Show when={message.role === 'assistant'}>
              <Show when={message.content !== ''}>
                <button
                  onclick={() => {
                    props.onMessageClick(message.content)
                  }}
                  class='bg-secondary rounded-lg py-2 px-3 flex justify-between hover:bg-highlight max-w-72 mb-3 w-full'
                >
                  <div class='flex flex-col justify-center pr-3'>
                    <ArrowLeft class='size-5' />
                  </div>
                  <div class='line-clamp-2 text-left markdown-compact text-sm'>
                    <SolidMarkdown text={() => cutText(message.content)} />
                  </div>
                </button>
              </Show>
            </Show>
            <Show when={message.role === 'user'}>
              <div class='flex flex-col items-end mb-3 ml-4'>
                <div class='bg-secondary rounded-lg py-2 px-3 flex justify-end max-w-72 text-left markdown-compact text-sm'>
                  {cutText(message.content)}
                </div>
              </div>
            </Show>
          </>
        )}
      </For>
    </div>
  )
}

function cutText(text: string) {
  return text.substring(0, 100) + ' ...'
}

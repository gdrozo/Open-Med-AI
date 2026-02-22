import { Accessor, Show, createSignal, createMemo } from 'solid-js'
import SolidMarkdown from '../Generics/SolidMarkdown'
import { Braces, ChevronDown, ChevronUp, Copy } from 'lucide-solid'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'

interface ResponseDisplayProps {
  response: Accessor<string>
  startingState: Accessor<boolean>
}

export default function ResponseDisplay(props: ResponseDisplayProps) {
  const [rendered, setRendered] = createSignal(true)
  const [showThinking, setShowThinking] = createSignal(true)

  useKeyboardShortcut(
    'c',
    () => {
      debugger
    },
    {
      ctrlKey: true,
      shiftKey: true,
    },
  )

  const parts = createMemo(() => {
    if (props.response().startsWith('<unused'))
      return props
        .response()
        .split('<unused')
        .map(part => '<unused' + part)
    else return ['', '', props.response()]
  })

  console.log(parts())
  const aiThinking = createMemo(() => parts()[1])
  const aiResponse = createMemo(() => parts()[2] || '')

  return (
    <div
      data-starting-state={props.startingState()}
      class={`flex flex-col pr-4  ${props.startingState() ? 'w-full max-w-[50rem]' : 'pb-4 grow '}`}
    >
      <h1 class={`text-2xl py-2 ${props.startingState() ? 'text-center' : ''}`}>
        OpenMed AI
      </h1>
      <div
        data-response-display={props.response()}
        class={`relative bg-secondary rounded-lg grow  overflow-y-auto ${props.startingState() ? 'hidden' : 'px-6 py-4 markdown-container'}`}
      >
        <button
          onclick={() => {
            navigator.clipboard.writeText(props.response())
          }}
          class='absolute top-4 right-6 rounded-full p-2 bg-main z-10'
        >
          <Copy class='size-4 hover:text-main text-gray-400' />
        </button>
        <button
          onclick={() => {
            setRendered(!rendered())
          }}
          class='absolute top-4 right-16 rounded-full p-2 bg-main z-10'
        >
          <Braces class='size-4 hover:text-main text-gray-400' />
        </button>
        <Show when={aiThinking() !== '' && rendered()}>
          <div class=''>
            <Show when={showThinking()}>
              <button
                onclick={() => {
                  setShowThinking(false)
                }}
                class='text-sm flex items-center gap-1 bg-main py-2 px-3  z-0 rounded-lg my-3 pr-4'
              >
                <ChevronUp class='size-4' />
                Hide Thinking
              </button>
            </Show>
            <Show when={!showThinking()}>
              <button
                onclick={() => {
                  setShowThinking(true)
                }}
                class='text-sm flex items-center gap-1 bg-main py-2 px-3  z-0 rounded-lg my-3'
              >
                <ChevronDown class='size-4' />
                Show Thinking
              </button>
            </Show>
            <Show when={showThinking()}>
              <SolidMarkdown
                text={aiThinking}
                class='ps-4 border-l border-gray-600'
              />
            </Show>
          </div>
        </Show>
        <Show when={aiResponse() !== '' && rendered()}>
          <SolidMarkdown text={aiResponse} />
        </Show>
        <Show when={props.response() !== '' && !rendered()}>
          <pre class='whitespace-pre-wrap text-main bg-main'>
            {props.response()}
          </pre>
        </Show>
      </div>
    </div>
  )
}

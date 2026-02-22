import { For, Show, createSignal } from 'solid-js'
import { Plus, MessageSquare, Trash2, Menu, Zap, Edit2 } from 'lucide-solid'
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut'
import { Workflow } from '../tauri/db'

interface SideBarProps {
  historyList: { id: number; title: string; created_at: string }[]
  workflows: Workflow[]
  currentChatId: number | null
  activeWorkflowId: number | null
  onNewChat: () => void
  onLoadChat: (id: number) => void
  onDeleteChat: (id: number) => void
  onSelectWorkflow: (id: number) => void
  onEditWorkflow: (id: number) => void
  onCreateWorkflow: () => void
  onDeleteWorkflow: (id: number) => void
}

export default function SideBar(props: SideBarProps) {
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true)

  useKeyboardShortcut('b', () => setIsSidebarOpen(!isSidebarOpen()), {
    ctrlKey: true,
  })

  return (
    <div
      class={` bg-dark border-r border-highlight flex flex-col pt-4 shrink-0 transition-all duration-200 ${isSidebarOpen() ? 'w-72' : 'w-[3.3rem]'}`}
    >
      <div class={` mb-6 ${isSidebarOpen() ? 'px-4' : 'px-2'}`}>
        <div
          class={`flex items-center gap-2 mb-4 ${isSidebarOpen() ? '' : ''}`}
        >
          <button
            class={` ${isSidebarOpen() ? '' : 'ml-2'}`}
            onclick={() => setIsSidebarOpen(!isSidebarOpen())}
          >
            <Menu class='size-5 text-main' strokeWidth={3} />
          </button>
          <h2
            class={`text-sm font-semibold text-main uppercase tracking-wider transition-all duration-200 ${isSidebarOpen() ? 'animate-fade-in' : 'animate-fade-out'}`}
          >
            History
          </h2>
        </div>
        <button
          onclick={props.onNewChat}
          class={`w-full flex items-center justify-center gap-2 bg-secondary hover:bg-highlight border border-highlight rounded-xl text-sm font-medium transition-all duration-200 group 
            ${isSidebarOpen() ? 'px-4 py-2.5' : 'py-1'}`}
        >
          <Plus class='size-4 group-hover:rotate-90 transition-transform duration-300' />
          <span
            class={` ${isSidebarOpen() ? 'animate-fade-in' : 'animate-fade-out'}`}
          >
            New Chat
          </span>
        </button>
      </div>
      <div class='grow overflow-y-auto px-3 space-y-1 pb-4'>
        <Show when={isSidebarOpen()}>
          <For each={props.historyList}>
            {item => (
              <div
                class={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${props.currentChatId === item.id ? 'bg-secondary border border-highlight shadow-lg' : 'hover:bg-highlight border border-transparent hover:border-highlight'}`}
                onclick={() => props.onLoadChat(item.id)}
              >
                <div class='flex items-center gap-3 overflow-hidden'>
                  <MessageSquare
                    class={`size-4 shrink-0 ${props.currentChatId === item.id ? 'text-blue-400' : 'text-gray-500'}`}
                  />
                  <span
                    class={`text-sm truncate ${props.currentChatId === item.id ? 'text-main' : 'text-main group-hover:text-gray-200'}`}
                  >
                    {item.title}
                  </span>
                </div>
                <button
                  onclick={e => {
                    e.stopPropagation()
                    props.onDeleteChat(item.id)
                  }}
                  class='opacity-0 group-hover:opacity-100 p-1.5 hover:bg-dark rounded-lg text-gray-500 hover:text-red-400 transition-all duration-200'
                >
                  <Trash2 class='size-4' />
                </button>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Workflows Section */}
      <div class={` mb-2 mt-4 ${isSidebarOpen() ? 'px-4' : 'px-4'}`}>
        <div class='flex items-center justify-between gap-2 mb-2'>
          <div class='flex items-center gap-2'>
            <h2
              class={`text-xs font-semibold text-main uppercase tracking-wider transition-all duration-200 ${isSidebarOpen() ? 'animate-fade-in' : 'hidden'}`}
            >
              Workflows
            </h2>
          </div>
          <Show when={isSidebarOpen()}>
            <button
              onclick={props.onCreateWorkflow}
              class='p-1 hover:bg-highlight rounded-md text-main hover:text-main transition-all'
              title='Create Workflow'
            >
              <Plus class='size-4' />
            </button>
          </Show>
        </div>
      </div>

      <div class='overflow-y-auto px-3 space-y-1 pb-4'>
        <Show when={isSidebarOpen()}>
          <For each={props.workflows}>
            {item => (
              <div
                class={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 ${props.activeWorkflowId === item.id ? 'bg-secondary border border-highlight shadow-lg' : 'hover:bg-highlight border border-transparent hover:border-highlight'}`}
                onclick={() => props.onSelectWorkflow(item.id)}
              >
                <div class='flex items-center gap-3 overflow-hidden'>
                  <Zap
                    class={`size-3.5 shrink-0 ${props.activeWorkflowId === item.id ? 'text-yellow-600' : 'text-main'}`}
                  />
                  <span
                    class={`text-sm truncate text-main ${props.activeWorkflowId === item.id ? '' : 'group-hover:text-gray-200'}`}
                  >
                    {item.name}
                  </span>
                </div>
                <div class='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                  <button
                    onclick={e => {
                      e.stopPropagation()
                      props.onEditWorkflow(item.id)
                    }}
                    class='p-1 hover:bg-dark rounded-lg text-gray-500 hover:text-blue-400'
                  >
                    <Edit2 class='size-3.5' />
                  </button>
                  <button
                    onclick={e => {
                      e.stopPropagation()
                      props.onDeleteWorkflow(item.id)
                    }}
                    class='p-1 hover:bg-dark rounded-lg text-gray-500 hover:text-red-400'
                  >
                    <Trash2 class='size-3.5' />
                  </button>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  )
}

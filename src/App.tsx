import './App.css'
import { createSignal, onMount, Show } from 'solid-js'

import Editor from './Components/Editor'
import { checkAIServer, startPythonServer } from './tauri/coms'
import { initDb } from './tauri/db'
import ServerStartUpLogs from './Components/StartScreen/ServerStartUpLogs'
import NoAIScreen from './Components/StartScreen/NoAIScreen'
import LoadingScreen from './Components/StartScreen/LoadingScreen'
import { Moon, Sun } from 'lucide-solid'

function App() {
  const [started, setStarted] = createSignal(false)
  const [logs, setLogs] = createSignal<string[]>([])
  const [screen, setScreen] = createSignal<'loading' | 'no-ai' | 'logs'>(
    'loading',
  )

  const [theme, setTheme] = createSignal<'dark' | 'light'>('dark')

  onMount(async () => {
    try {
      await initDb()
    } catch (e) {
      console.error('Failed to init DB', e)
      return
    }

    const serverRunning = await checkAIServer()
    if (serverRunning) {
      console.log('Server up')
      setStarted(true)
      return
    }
    console.log('No server')
    setScreen('no-ai')
  })

  function startServer() {
    setLogs([])
    setScreen('logs')
    startPythonServer(msg => {
      setLogs(prev => [...prev, msg])
    }).then(() => {
      setStarted(true)
    })
  }

  function switchTheme() {
    setTheme(theme() === 'dark' ? 'light' : 'dark')
  }

  return (
    <main
      class={`bg-main h-screen w-screen flex flex-col justify-center items-center gap-4 text-main overflow-hidden ${theme()}`}
    >
      <div class='fixed right-2 top-2 z-50'>
        <button onclick={switchTheme}>
          <Show when={theme() === 'dark'}>
            <Sun class='size-5' />
          </Show>
          <Show when={theme() === 'light'}>
            <Moon class='size-5' />
          </Show>
        </button>
      </div>
      <Show when={started()}>
        <Editor />
      </Show>

      <Show when={!started()}>
        <Show when={screen() === 'no-ai'}>
          <NoAIScreen
            startServer={startServer}
            enterWithoutAI={() => {
              setStarted(true)
            }}
          />
        </Show>

        <Show when={screen() === 'logs'}>
          <ServerStartUpLogs logs={logs()} />
        </Show>

        <Show when={screen() === 'loading'}>
          <LoadingScreen />
        </Show>
      </Show>
    </main>
  )
}

export default App

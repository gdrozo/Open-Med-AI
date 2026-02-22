import { getPythonServerUrl, setPythonServerUrl } from '../../tauri/coms'

export default function NoAIScreen(props: {
  startServer: () => void
  enterWithoutAI: () => void
}) {
  return (
    <div class='flex flex-col items-center gap-4'>
      <div class='flex text-2xl'>No Server Was Found</div>
      <div class='bg-[#2a2a2a] pl-2 rounded-lg text-white'>
        URL: {getPythonServerUrl()}
        <button
          class='bg-gray-500 p-2 rounded-e-lg ml-2'
          onClick={() => {
            setPythonServerUrl('http://[IP_ADDRESS]/')
          }}
        >
          Try to connect
        </button>
      </div>
      <div class='flex gap-4 text-white'>
        <button class='bg-gray-500 p-2 rounded-lg' onClick={props.startServer}>
          Start Local Server
        </button>
        <button
          class='bg-red-400 p-2 rounded-lg'
          onClick={props.enterWithoutAI}
        >
          Enter without AI
        </button>
      </div>
    </div>
  )
}

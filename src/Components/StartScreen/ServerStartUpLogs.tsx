import { For, createEffect, on } from 'solid-js'
import './ServerStartUpLogs.css'

export default function ServerStartUpLogs(props: { logs: string[] }) {
  let logContainer: HTMLDivElement | undefined

  createEffect(
    on(
      () => props.logs.length,
      () => {
        if (logContainer) {
          logContainer.scrollTop = logContainer.scrollHeight
        }
      },
    ),
  )

  return (
    <div class='flex flex-col items-center gap-4'>
      <div class='flex text-2xl'>
        Starting the AI Server
        <div class='ml-1 in-and-out' style='--d:0s'>
          .
        </div>
        <div class='in-and-out' style='--d:0.2s'>
          .
        </div>
        <div class='in-and-out' style='--d:0.4s'>
          .
        </div>
      </div>
      <div
        ref={logContainer}
        class='bg-black/50 p-4 rounded-lg w-[80vw] h-[40vh] overflow-y-auto font-mono text-xs border border-white/20'
      >
        <For
          each={props.logs}
          fallback={
            <div class='flex text-gray-500'>
              Waiting for output
              <div class='ml-1 in-and-out' style='--d:0s'>
                .
              </div>
              <div class='in-and-out' style='--d:0.2s'>
                .
              </div>
              <div class='in-and-out' style='--d:0.4s'>
                .
              </div>
            </div>
          }
        >
          {log => <div class='mb-1 whitespace-pre-wrap text-xs'>{log}</div>}
        </For>
      </div>
    </div>
  )
}

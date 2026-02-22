import { createSignal, onMount, For } from 'solid-js'
import { X, Plus, Trash2, GripVertical } from 'lucide-solid'
import { Workflow, getWorkflowSteps } from '../tauri/db'

interface WorkflowEditorProps {
  workflowId: number | null
  onSave: (
    name: string,
    requiredContext: string,
    steps: { prompt: string; step_order: number }[],
  ) => Promise<void>
  onClose: () => void
  existingWorkflows: Workflow[]
}

export default function WorkflowEditor(props: WorkflowEditorProps) {
  const [name, setName] = createSignal('')
  const [requiredContext, setRequiredContext] = createSignal('none')
  const [steps, setSteps] = createSignal<
    { prompt: string; step_order: number }[]
  >([])

  onMount(async () => {
    if (props.workflowId) {
      const wf = props.existingWorkflows.find(w => w.id === props.workflowId)
      if (wf) {
        setName(wf.name)
        setRequiredContext(wf.required_context)
        const s = await getWorkflowSteps(props.workflowId)
        setSteps(
          s.map(step => ({ prompt: step.prompt, step_order: step.step_order })),
        )
      }
    } else {
      setSteps([{ prompt: '', step_order: 0 }])
    }
  })

  const addStep = () => {
    setSteps([...steps(), { prompt: '', step_order: steps().length }])
  }

  const removeStep = (index: number) => {
    setSteps(
      steps()
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, step_order: i })),
    )
  }

  const updateStep = (index: number, prompt: string) => {
    const newSteps = [...steps()]
    newSteps[index] = { ...newSteps[index], prompt }
    setSteps(newSteps)
  }

  const handleSave = async () => {
    if (!name().trim()) return
    await props.onSave(name(), requiredContext(), steps())
  }

  return (
    <div class='fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
      <div class='bg-dark border border-highlight w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200'>
        {/* Header */}
        <div class='p-6 border-b border-highlight flex items-center justify-between'>
          <h2 class='text-xl font-bold text-main'>
            {props.workflowId ? 'Edit Workflow' : 'Create Workflow'}
          </h2>
          <button
            onclick={props.onClose}
            class='text-gray-400 hover:text-main transition-colors'
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div class='p-6 grow overflow-y-auto space-y-6 custom-scrollbar'>
          <div>
            <label class='block text-sm font-medium text-main mb-2'>
              Workflow Name
            </label>
            <input
              type='text'
              value={name()}
              onInput={e => setName(e.currentTarget.value)}
              placeholder='e.g., Patient Analysis'
              class='w-full bg-secondary border border-highlight rounded-xl px-4 py-3 text-main focus:outline-none focus:border-blue-500 transition-colors'
            />
          </div>

          <div>
            <label class='block text-sm font-medium text-main mb-2'>
              Required Context
            </label>
            <div class='relative'>
              <select
                value={requiredContext()}
                onChange={e => setRequiredContext(e.currentTarget.value)}
                class='w-full bg-secondary border border-highlight rounded-xl px-4 py-3 text-main focus:outline-none focus:border-blue-500 transition-colors appearance-none'
              >
                <option value='none'>None (Direct Prompt)</option>
                <option value='files'>Files/Folders Required</option>
                <option value='image'>Image Required</option>
                <option value='any'>Any (Files or Image)</option>
              </select>
              <div class='absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500'>
                <GripVertical size={14} class='rotate-90' />
              </div>
            </div>
          </div>

          <div class='space-y-4'>
            <div class='flex items-center justify-between'>
              <label class='text-sm font-medium text-main'>Steps</label>
              <button
                onclick={addStep}
                class='flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors'
              >
                <Plus size={16} /> Add Step
              </button>
            </div>

            <div class='space-y-3'>
              <For each={steps()}>
                {(step, index) => (
                  <div class='group relative flex items-start gap-3 bg-secondary p-4 rounded-xl border border-highlight hover:border-[#444] transition-all'>
                    <div class='mt-2 text-main'>
                      <GripVertical size={18} />
                    </div>
                    <div class='grow'>
                      <div class='flex items-center gap-2 mb-2'>
                        <span class='text-[10px] font-bold text-main uppercase tracking-[0.2em]'>
                          Step {index() + 1}
                        </span>
                      </div>
                      <textarea
                        value={step.prompt}
                        onInput={e =>
                          updateStep(index(), e.currentTarget.value)
                        }
                        placeholder='Enter instruction for the AI...'
                        class='w-full bg-transparent text-main placeholder-main resize-none focus:outline-none text-sm leading-relaxed'
                        rows={2}
                      />
                    </div>
                    <button
                      onclick={() => removeStep(index())}
                      class='opacity-0 group-hover:opacity-100 p-2 text-main hover:text-red-400 transition-all'
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div class='p-6 border-t border-highlight flex items-center justify-end gap-3'>
          <button
            onclick={props.onClose}
            class='px-6 py-2.5 rounded-xl font-medium text-main hover:bg-highlight hover:text-main transition-all'
          >
            Cancel
          </button>
          <button
            onclick={handleSave}
            class='px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium shadow-lg shadow-blue-900/20 transition-all'
          >
            Save Workflow
          </button>
        </div>
      </div>
    </div>
  )
}

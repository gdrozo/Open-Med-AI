import { Loader } from 'lucide-solid'

export default function LoadingScreen() {
  return (
    <div class='text-3xl'>
      <Loader class='animate-spin' size={52} />
    </div>
  )
}

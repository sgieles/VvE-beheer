import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <p className="text-7xl font-bold text-gray-200 mb-4">404</p>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Pagina niet gevonden</h1>
      <p className="text-gray-500 mb-6">De pagina die u zoekt bestaat niet of is verplaatst.</p>
      <Link
        to="/"
        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
      >
        <Home size={16} />
        Terug naar dashboard
      </Link>
    </div>
  )
}

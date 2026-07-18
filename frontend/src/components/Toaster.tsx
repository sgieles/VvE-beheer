import { useToastStore } from '@/store/toastStore'
import { Check, AlertCircle, Info, X } from 'lucide-react'

export default function Toaster() {
  const { toasts, removeToast } = useToastStore()
  if (!toasts.length) return null

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 min-w-[260px] max-w-sm"
          style={{ animation: 'toast-in 0.2s ease-out' }}
        >
          {t.type === 'success' && <Check size={16} className="text-green-500 mt-0.5 shrink-0" />}
          {t.type === 'error' && <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />}
          {t.type === 'info' && <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />}
          <p className="text-sm text-gray-800 flex-1 leading-snug">{t.message}</p>
          <button onClick={() => removeToast(t.id)} className="text-gray-300 hover:text-gray-500 shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

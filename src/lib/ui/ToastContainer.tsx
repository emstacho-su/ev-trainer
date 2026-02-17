'use client';

import { useToast } from './toastContext';

const TYPE_STYLES: Record<string, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-stone-600 text-white',
  warning: 'bg-yellow-600 text-white',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 rounded px-4 py-2 shadow-lg transition-all duration-300 ${TYPE_STYLES[toast.type] ?? TYPE_STYLES.info}`}
        >
          <span className="text-sm">{toast.message}</span>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="ml-2 text-white/80 hover:text-white"
            aria-label="Dismiss"
          >
            &#x2715;
          </button>
        </div>
      ))}
    </div>
  );
}

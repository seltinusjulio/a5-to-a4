import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Check, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, 'id'>) => string;
  showSuccess: (title: string, message: string, duration?: number) => string;
  showError: (title: string, message: string, duration?: number) => string;
  showWarning: (title: string, message: string, duration?: number) => string;
  showInfo: (title: string, message: string, duration?: number) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 5000 }: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (title: string, message: string, duration = 5000) => {
      return showToast({ type: 'success', title, message, duration });
    },
    [showToast]
  );

  const showError = useCallback(
    (title: string, message: string, duration = 6000) => {
      return showToast({ type: 'error', title, message, duration });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (title: string, message: string, duration = 5000) => {
      return showToast({ type: 'warning', title, message, duration });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (title: string, message: string, duration = 4000) => {
      return showToast({ type: 'info', title, message, duration });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        removeToast,
        clearAllToasts,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm sm:max-w-md w-full pointer-events-none px-3 sm:px-0"
    >
      {toasts.map((toast) => {
        const typeConfig = {
          success: {
            border: 'border-emerald-700 dark:border-emerald-500',
            iconWrap: 'bg-emerald-700 dark:bg-emerald-600 text-white',
            icon: <Check className="w-3.5 h-3.5" />,
            label: 'Selesai',
          },
          error: {
            border: 'border-red-700 dark:border-red-500',
            iconWrap: 'bg-red-700 dark:bg-red-600 text-white',
            icon: <AlertCircle className="w-3.5 h-3.5" />,
            label: 'Galat',
          },
          warning: {
            border: 'border-amber-600 dark:border-amber-500',
            iconWrap: 'bg-amber-600 dark:bg-amber-500 text-white',
            icon: <AlertTriangle className="w-3.5 h-3.5" />,
            label: 'Perhatian',
          },
          info: {
            border: 'border-neutral-900 dark:border-neutral-400',
            iconWrap: 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950',
            icon: <Info className="w-3.5 h-3.5" />,
            label: 'Info',
          },
        }[toast.type];

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-none bg-white dark:bg-[#161616] text-neutral-950 dark:text-neutral-100 border ${typeConfig.border} transition-opacity duration-150`}
          >
            <div className={`w-6 h-6 shrink-0 flex items-center justify-center ${typeConfig.iconWrap}`}>
              {typeConfig.icon}
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-xs font-bold leading-tight text-neutral-950 dark:text-white">
                {toast.title}
              </h4>
              <p className="text-xs mt-1 leading-relaxed text-neutral-600 dark:text-neutral-300 break-words">
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => onRemove(toast.id)}
              className="p-1 text-neutral-500 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0 cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

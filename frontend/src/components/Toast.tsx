import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Copy, Check, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'error' | 'success' | 'info';
  title?: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-16 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const handleCopy = () => {
    navigator.clipboard.writeText(toast.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isError = toast.type === 'error';

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-md transition-all animate-slide-up ${
        isError
          ? 'bg-rose-950/90 border-rose-800/80 text-rose-200'
          : 'bg-emerald-950/90 border-emerald-800/80 text-emerald-200'
      }`}
    >
      {isError ? (
        <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
      ) : (
        <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
      )}
      <div className="flex-1 min-w-0 text-xs font-sans">
        {toast.title && <h4 className="font-bold mb-0.5 tracking-tight">{toast.title}</h4>}
        <p className="leading-relaxed opacity-90 break-words">{toast.message}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleCopy}
          className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity hover:bg-black/20"
          title="Copy message to clipboard"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => onDismiss(toast.id)}
          className="p-1 rounded-lg opacity-70 hover:opacity-100 transition-opacity hover:bg-black/20"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = 'info', message, duration = 5000 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const toast = { id, type, message };

      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
      return id;
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 380,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => {
          let bgColor = '#1e293b';
          let borderColor = '#334155';
          let textColor = '#ffffff';
          let Icon = Info;

          if (toast.type === 'success') {
            bgColor = '#065f46';
            borderColor = '#059669';
            Icon = CheckCircle2;
          } else if (toast.type === 'error') {
            bgColor = '#991b1b';
            borderColor = '#dc2626';
            Icon = XCircle;
          } else if (toast.type === 'warning') {
            bgColor = '#92400e';
            borderColor = '#d97706';
            Icon = AlertTriangle;
          }

          return (
            <div
              key={toast.id}
              role="alert"
              style={{
                pointerEvents: 'auto',
                background: bgColor,
                color: textColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 8,
                padding: '12px 16px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: '0.88rem',
                lineHeight: 1.4,
                animation: 'slideIn 0.2s ease-out',
              }}
            >
              <Icon size={20} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: 2,
                  opacity: 0.8,
                  display: 'flex',
                }}
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if used outside ToastProvider
    return {
      addToast: ({ message }) => console.log('[Toast fallback]:', message),
      removeToast: () => {},
    };
  }
  return context;
}

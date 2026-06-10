import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './Toast.module.css';

export type ToastKind = 'neutral' | 'success' | 'danger';

interface ToastEntry {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastApi {
  /** Show a transient message. Returns the toast id. */
  toast: (message: string, kind?: ToastKind) => number;
}

const ToastContext = createContext<ToastApi | null>(null);

const TOAST_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastKind = 'neutral') => {
    const id = nextId.current++;
    setEntries(prev => [...prev, { id, message, kind }]);
    window.setTimeout(() => {
      setEntries(prev => prev.filter(e => e.id !== id));
    }, TOAST_MS);
    return id;
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.viewport} role="status" aria-live="polite">
        {entries.map(e => (
          <div
            key={e.id}
            className={[
              styles.toast,
              e.kind !== 'neutral' ? styles[e.kind] : null,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {e.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

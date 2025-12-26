import { createSignal } from '@/core/signal';

export type ToastType = 'default' | 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration: number;
}

export interface ToastStore {
  getToasts: () => Toast[];
  add: (toast: Omit<Toast, 'id'>) => string;
  remove: (id: string) => void;
  clear: () => void;
  subscribe: (callback: () => void) => () => void;
}

let toastIdCounter = 0;

export function createToastStore(): ToastStore {
  const [toasts, setToasts] = createSignal<Toast[]>([]);
  const subscribers = new Set<() => void>();
  
  const notify = (): void => {
    subscribers.forEach(fn => fn());
  };
  
  const add = (toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${++toastIdCounter}`;
    const newToast: Toast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);
    notify();
    
    if (toast.duration > 0) {
      setTimeout(() => {
        remove(id);
      }, toast.duration);
    }
    
    return id;
  };
  
  const remove = (id: string): void => {
    setToasts(prev => prev.filter(t => t.id !== id));
    notify();
  };
  
  const clear = (): void => {
    setToasts([]);
    notify();
  };
  
  return {
    getToasts: toasts,
    add,
    remove,
    clear,
    subscribe: (callback: () => void): (() => void) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    }
  };
}

let globalToastStore: ToastStore | null = null;

export function getToastStore(): ToastStore {
  if (!globalToastStore) {
    globalToastStore = createToastStore();
  }
  return globalToastStore;
}

export function showToast(
  title: string, 
  description?: string, 
  type: ToastType = 'default',
  duration: number = 4000
): string {
  return getToastStore().add({ title, description, type, duration });
}

export function showSuccessToast(title: string, description?: string): string {
  return showToast(title, description, 'success');
}

export function showErrorToast(title: string, description?: string): string {
  return showToast(title, description, 'error');
}

export function showWarningToast(title: string, description?: string): string {
  return showToast(title, description, 'warning');
}
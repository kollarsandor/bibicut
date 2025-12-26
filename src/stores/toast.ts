import { createSignal, batch } from '@/core/signal';

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
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

export function createToastStore(): ToastStore {
  const [toasts, setToasts] = createSignal<Toast[]>([]);
  const subscribers = new Set<() => void>();
  
  const notify = (): void => {
    const subs = Array.from(subscribers);
    const len = subs.length;
    for (let i = 0; i < len; i++) {
      subs[i]();
    }
  };
  
  const add = (toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${++toastIdCounter}`;
    const newToast: Toast = { ...toast, id };
    
    setToasts(prev => {
      const updated = prev.slice();
      updated.push(newToast);
      return updated;
    });
    notify();
    
    if (toast.duration > 0) {
      const timeoutId = setTimeout(() => {
        remove(id);
        toastTimeouts.delete(id);
      }, toast.duration);
      toastTimeouts.set(id, timeoutId);
    }
    
    return id;
  };
  
  const remove = (id: string): void => {
    const timeoutId = toastTimeouts.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      toastTimeouts.delete(id);
    }
    
    setToasts(prev => {
      const result: Toast[] = [];
      const len = prev.length;
      for (let i = 0; i < len; i++) {
        if (prev[i].id !== id) {
          result.push(prev[i]);
        }
      }
      return result;
    });
    notify();
  };
  
  const clear = (): void => {
    toastTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    toastTimeouts.clear();
    
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

export function dismissToast(id: string): void {
  getToastStore().remove(id);
}

export function clearAllToasts(): void {
  getToastStore().clear();
}

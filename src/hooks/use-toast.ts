import { useState, useEffect } from 'react';

export interface ToastData {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  open?: boolean;
}

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 4000;

let toastIdCounter = 0;
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
let toastState: ToastData[] = [];
const listeners = new Set<(state: ToastData[]) => void>();

function generateId(): string {
  toastIdCounter = (toastIdCounter + 1) % Number.MAX_SAFE_INTEGER;
  return String(toastIdCounter);
}

function notifyListeners(): void {
  const listenerArray = Array.from(listeners);
  const len = listenerArray.length;
  for (let i = 0; i < len; i++) {
    listenerArray[i]([...toastState]);
  }
}

function addToRemoveQueue(toastId: string): void {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    toastState = toastState.filter(t => t.id !== toastId);
    notifyListeners();
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
}

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export interface ToastReturn {
  id: string;
  dismiss: () => void;
  update: (props: Partial<ToastData>) => void;
}

export function toast(options: ToastOptions): ToastReturn {
  const id = generateId();
  
  const newToast: ToastData = {
    id,
    title: options.title,
    description: options.description,
    variant: options.variant || 'default',
    open: true,
  };
  
  toastState = [newToast, ...toastState].slice(0, TOAST_LIMIT);
  notifyListeners();
  
  addToRemoveQueue(id);
  
  const dismiss = (): void => {
    const existingTimeout = toastTimeouts.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      toastTimeouts.delete(id);
    }
    
    toastState = toastState.map(t => 
      t.id === id ? { ...t, open: false } : t
    );
    notifyListeners();
    
    setTimeout(() => {
      toastState = toastState.filter(t => t.id !== id);
      notifyListeners();
    }, 300);
  };
  
  const update = (props: Partial<ToastData>): void => {
    toastState = toastState.map(t =>
      t.id === id ? { ...t, ...props } : t
    );
    notifyListeners();
  };
  
  return { id, dismiss, update };
}

export interface UseToastReturn {
  toasts: ToastData[];
  toast: typeof toast;
  dismiss: (toastId?: string) => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<ToastData[]>(() => [...toastState]);
  
  useEffect(() => {
    const listener = (state: ToastData[]): void => {
      setToasts(state);
    };
    
    listeners.add(listener);
    
    return () => {
      listeners.delete(listener);
    };
  }, []);
  
  const dismiss = (toastId?: string): void => {
    if (toastId) {
      const existingTimeout = toastTimeouts.get(toastId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        toastTimeouts.delete(toastId);
      }
      
      toastState = toastState.map(t =>
        t.id === toastId ? { ...t, open: false } : t
      );
      notifyListeners();
      
      setTimeout(() => {
        toastState = toastState.filter(t => t.id !== toastId);
        notifyListeners();
      }, 300);
    } else {
      toastTimeouts.forEach((timeout) => {
        clearTimeout(timeout);
      });
      toastTimeouts.clear();
      
      toastState = toastState.map(t => ({ ...t, open: false }));
      notifyListeners();
      
      setTimeout(() => {
        toastState = [];
        notifyListeners();
      }, 300);
    }
  };
  
  return {
    toasts,
    toast,
    dismiss,
  };
}
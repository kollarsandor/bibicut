type Subscriber = () => void;

let currentSubscriber: Subscriber | null = null;
const subscriberStack: Subscriber[] = [];

export function createSignal<T>(initialValue: T): [() => T, (newValue: T | ((prev: T) => T)) => void] {
  let value = initialValue;
  const subscribers = new Set<Subscriber>();

  const read = (): T => {
    if (currentSubscriber) {
      subscribers.add(currentSubscriber);
    }
    return value;
  };

  const write = (newValue: T | ((prev: T) => T)): void => {
    const nextValue = typeof newValue === 'function' 
      ? (newValue as (prev: T) => T)(value) 
      : newValue;
    
    if (!Object.is(value, nextValue)) {
      value = nextValue;
      const currentSubs = Array.from(subscribers);
      for (let i = 0; i < currentSubs.length; i++) {
        currentSubs[i]();
      }
    }
  };

  return [read, write];
}

export function createEffect(fn: () => void | (() => void)): () => void {
  let cleanup: (() => void) | void;
  
  const execute = (): void => {
    if (cleanup) {
      cleanup();
    }
    subscriberStack.push(execute);
    currentSubscriber = execute;
    try {
      cleanup = fn();
    } finally {
      subscriberStack.pop();
      currentSubscriber = subscriberStack[subscriberStack.length - 1] || null;
    }
  };
  
  execute();
  
  return () => {
    if (cleanup) {
      cleanup();
    }
  };
}

export function createMemo<T>(fn: () => T): () => T {
  const [value, setValue] = createSignal<T>(undefined as T);
  let initialized = false;
  
  createEffect(() => {
    const newValue = fn();
    if (!initialized || !Object.is(value(), newValue)) {
      setValue(newValue);
      initialized = true;
    }
  });
  
  return value;
}

export function batch(fn: () => void): void {
  const prevSubscriber = currentSubscriber;
  currentSubscriber = null;
  try {
    fn();
  } finally {
    currentSubscriber = prevSubscriber;
  }
}

export function untrack<T>(fn: () => T): T {
  const prevSubscriber = currentSubscriber;
  currentSubscriber = null;
  try {
    return fn();
  } finally {
    currentSubscriber = prevSubscriber;
  }
}

export interface SignalStore<T extends Record<string, unknown>> {
  get: <K extends keyof T>(key: K) => T[K];
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  update: <K extends keyof T>(key: K, updater: (prev: T[K]) => T[K]) => void;
  subscribe: (fn: () => void) => () => void;
}

export function createStore<T extends Record<string, unknown>>(initial: T): SignalStore<T> {
  const signals = new Map<keyof T, [() => T[keyof T], (v: T[keyof T]) => void]>();
  const listeners = new Set<() => void>();
  
  for (const key in initial) {
    if (Object.prototype.hasOwnProperty.call(initial, key)) {
      signals.set(key, createSignal(initial[key]) as [() => T[keyof T], (v: T[keyof T]) => void]);
    }
  }
  
  return {
    get: <K extends keyof T>(key: K): T[K] => {
      const signal = signals.get(key);
      if (signal) {
        return signal[0]() as T[K];
      }
      return initial[key];
    },
    set: <K extends keyof T>(key: K, value: T[K]): void => {
      let signal = signals.get(key);
      if (!signal) {
        signal = createSignal(value) as [() => T[keyof T], (v: T[keyof T]) => void];
        signals.set(key, signal);
      } else {
        signal[1](value);
      }
      listeners.forEach(fn => fn());
    },
    update: <K extends keyof T>(key: K, updater: (prev: T[K]) => T[K]): void => {
      const signal = signals.get(key);
      if (signal) {
        signal[1](updater(signal[0]() as T[K]));
        listeners.forEach(fn => fn());
      }
    },
    subscribe: (fn: () => void): (() => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}
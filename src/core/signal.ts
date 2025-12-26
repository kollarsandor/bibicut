type Subscriber = () => void;

let currentSubscriber: Subscriber | null = null;
const subscriberStack: Subscriber[] = [];
let batchDepth = 0;
const pendingEffects: Set<Subscriber> = new Set();

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
      if (batchDepth > 0) {
        subscribers.forEach(sub => pendingEffects.add(sub));
      } else {
        const currentSubs = Array.from(subscribers);
        for (let i = 0; i < currentSubs.length; i++) {
          currentSubs[i]();
        }
      }
    }
  };

  return [read, write];
}

export function createEffect(fn: () => void | (() => void)): () => void {
  let cleanup: (() => void) | void;
  let isDisposed = false;
  
  const execute = (): void => {
    if (isDisposed) return;
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
    isDisposed = true;
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
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const effects = Array.from(pendingEffects);
      pendingEffects.clear();
      for (let i = 0; i < effects.length; i++) {
        effects[i]();
      }
    }
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
  snapshot: () => T;
}

export function createStore<T extends Record<string, unknown>>(initial: T): SignalStore<T> {
  const signals = new Map<keyof T, [() => T[keyof T], (v: T[keyof T]) => void]>();
  const listeners = new Set<() => void>();
  
  for (const key in initial) {
    if (Object.prototype.hasOwnProperty.call(initial, key)) {
      signals.set(key, createSignal(initial[key]) as [() => T[keyof T], (v: T[keyof T]) => void]);
    }
  }
  
  const notifyListeners = (): void => {
    if (batchDepth > 0) {
      listeners.forEach(fn => pendingEffects.add(fn));
    } else {
      listeners.forEach(fn => fn());
    }
  };
  
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
      notifyListeners();
    },
    update: <K extends keyof T>(key: K, updater: (prev: T[K]) => T[K]): void => {
      const signal = signals.get(key);
      if (signal) {
        signal[1](updater(signal[0]() as T[K]));
        notifyListeners();
      }
    },
    subscribe: (fn: () => void): (() => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    snapshot: (): T => {
      const result = {} as T;
      signals.forEach((signal, key) => {
        (result as Record<keyof T, unknown>)[key] = signal[0]();
      });
      return result;
    }
  };
}

export function createComputed<T>(fn: () => T): () => T {
  let cachedValue: T;
  let dirty = true;
  const subscribers = new Set<Subscriber>();
  
  const compute = (): void => {
    if (dirty) {
      subscriberStack.push(compute);
      currentSubscriber = compute;
      try {
        cachedValue = fn();
        dirty = false;
      } finally {
        subscriberStack.pop();
        currentSubscriber = subscriberStack[subscriberStack.length - 1] || null;
      }
      subscribers.forEach(sub => sub());
    }
  };
  
  return (): T => {
    if (currentSubscriber) {
      subscribers.add(currentSubscriber);
    }
    if (dirty) {
      compute();
    }
    return cachedValue;
  };
}

export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const cleanups: (() => void)[] = [];
  const prevSubscriber = currentSubscriber;
  
  const dispose = (): void => {
    for (let i = cleanups.length - 1; i >= 0; i--) {
      cleanups[i]();
    }
    cleanups.length = 0;
  };
  
  currentSubscriber = null;
  
  try {
    return fn(dispose);
  } finally {
    currentSubscriber = prevSubscriber;
  }
}

export function onCleanup(fn: () => void): void {
  if (currentSubscriber) {
    const subscriber = currentSubscriber;
    const originalFn = subscriber;
    const wrappedSubscriber = (): void => {
      fn();
      originalFn();
    };
    Object.assign(subscriber, wrappedSubscriber);
  }
}

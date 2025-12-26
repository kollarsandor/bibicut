type Task = () => void;
type Priority = 'immediate' | 'high' | 'normal' | 'low' | 'idle';

interface ScheduledTask {
  task: Task;
  priority: Priority;
  id: number;
}

const immediateQueue: Task[] = [];
const highQueue: Task[] = [];
const normalQueue: Task[] = [];
const lowQueue: Task[] = [];
const idleQueue: Task[] = [];

let taskIdCounter = 0;
let isFlushScheduled = false;
let isFlushing = false;

const priorityValues: Record<Priority, number> = {
  immediate: 0,
  high: 1,
  normal: 2,
  low: 3,
  idle: 4
};

function getQueue(priority: Priority): Task[] {
  switch (priority) {
    case 'immediate':
      return immediateQueue;
    case 'high':
      return highQueue;
    case 'normal':
      return normalQueue;
    case 'low':
      return lowQueue;
    case 'idle':
      return idleQueue;
  }
}

function scheduleFlush(): void {
  if (isFlushScheduled) return;
  isFlushScheduled = true;
  
  if (immediateQueue.length > 0) {
    queueMicrotask(flush);
  } else if (highQueue.length > 0) {
    Promise.resolve().then(flush);
  } else if (normalQueue.length > 0) {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(flush);
    } else {
      setTimeout(flush, 0);
    }
  } else if (lowQueue.length > 0) {
    setTimeout(flush, 0);
  } else if (idleQueue.length > 0) {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => flush());
    } else {
      setTimeout(flush, 100);
    }
  }
}

function flush(): void {
  if (isFlushing) return;
  isFlushing = true;
  isFlushScheduled = false;
  
  const startTime = performance.now();
  const maxTime = 16;
  
  try {
    while (immediateQueue.length > 0) {
      const task = immediateQueue.shift()!;
      task();
    }
    
    while (highQueue.length > 0 && performance.now() - startTime < maxTime) {
      const task = highQueue.shift()!;
      task();
    }
    
    while (normalQueue.length > 0 && performance.now() - startTime < maxTime) {
      const task = normalQueue.shift()!;
      task();
    }
    
    while (lowQueue.length > 0 && performance.now() - startTime < maxTime) {
      const task = lowQueue.shift()!;
      task();
    }
    
    if (idleQueue.length > 0 && performance.now() - startTime < maxTime * 2) {
      const task = idleQueue.shift()!;
      task();
    }
  } finally {
    isFlushing = false;
  }
  
  if (
    immediateQueue.length > 0 ||
    highQueue.length > 0 ||
    normalQueue.length > 0 ||
    lowQueue.length > 0 ||
    idleQueue.length > 0
  ) {
    scheduleFlush();
  }
}

export function schedule(task: Task, priority: Priority = 'normal'): number {
  const id = ++taskIdCounter;
  const queue = getQueue(priority);
  queue.push(task);
  scheduleFlush();
  return id;
}

export function scheduleImmediate(task: Task): number {
  return schedule(task, 'immediate');
}

export function scheduleHigh(task: Task): number {
  return schedule(task, 'high');
}

export function scheduleNormal(task: Task): number {
  return schedule(task, 'normal');
}

export function scheduleLow(task: Task): number {
  return schedule(task, 'low');
}

export function scheduleIdle(task: Task): number {
  return schedule(task, 'idle');
}

export function flushSync(): void {
  isFlushScheduled = false;
  
  while (
    immediateQueue.length > 0 ||
    highQueue.length > 0 ||
    normalQueue.length > 0 ||
    lowQueue.length > 0 ||
    idleQueue.length > 0
  ) {
    while (immediateQueue.length > 0) {
      immediateQueue.shift()!();
    }
    while (highQueue.length > 0) {
      highQueue.shift()!();
    }
    while (normalQueue.length > 0) {
      normalQueue.shift()!();
    }
    while (lowQueue.length > 0) {
      lowQueue.shift()!();
    }
    while (idleQueue.length > 0) {
      idleQueue.shift()!();
    }
  }
}

export function clearQueue(priority?: Priority): void {
  if (priority) {
    const queue = getQueue(priority);
    queue.length = 0;
  } else {
    immediateQueue.length = 0;
    highQueue.length = 0;
    normalQueue.length = 0;
    lowQueue.length = 0;
    idleQueue.length = 0;
  }
}

export function getQueueLength(priority?: Priority): number {
  if (priority) {
    return getQueue(priority).length;
  }
  return (
    immediateQueue.length +
    highQueue.length +
    normalQueue.length +
    lowQueue.length +
    idleQueue.length
  );
}

export function defer(task: Task): Promise<void> {
  return new Promise((resolve) => {
    schedule(() => {
      task();
      resolve();
    }, 'normal');
  });
}

export function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 16);
    }
  });
}

export function throttleFrame<T extends (...args: Parameters<T>) => void>(
  fn: T
): (...args: Parameters<T>) => void {
  let frameId: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  return (...args: Parameters<T>): void => {
    lastArgs = args;
    
    if (frameId === null) {
      frameId = requestAnimationFrame(() => {
        frameId = null;
        if (lastArgs) {
          fn(...lastArgs);
        }
      });
    }
  };
}

export function debounceFrame<T extends (...args: Parameters<T>) => void>(
  fn: T
): (...args: Parameters<T>) => void {
  let frameId: number | null = null;
  
  return (...args: Parameters<T>): void => {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
    }
    
    frameId = requestAnimationFrame(() => {
      frameId = null;
      fn(...args);
    });
  };
}
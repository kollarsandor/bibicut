type Task = () => void;
type Priority = 'immediate' | 'high' | 'normal' | 'low' | 'idle';

interface ScheduledTask {
  task: Task;
  priority: Priority;
  id: number;
  cancelled: boolean;
}

const immediateQueue: ScheduledTask[] = [];
const highQueue: ScheduledTask[] = [];
const normalQueue: ScheduledTask[] = [];
const lowQueue: ScheduledTask[] = [];
const idleQueue: ScheduledTask[] = [];

let taskIdCounter = 0;
let isFlushScheduled = false;
let isFlushing = false;

const FRAME_BUDGET_MS = 16;
const IDLE_BUDGET_MS = 50;

function getQueue(priority: Priority): ScheduledTask[] {
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
    setTimeout(flush, 4);
  } else if (idleQueue.length > 0) {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => flush(), { timeout: 100 });
    } else {
      setTimeout(flush, 100);
    }
  }
}

function processQueue(queue: ScheduledTask[], budget: number, startTime: number): boolean {
  while (queue.length > 0) {
    if (performance.now() - startTime >= budget) {
      return false;
    }
    const task = queue.shift()!;
    if (!task.cancelled) {
      try {
        task.task();
      } catch (e) {
        console.error('Task execution error:', e);
      }
    }
  }
  return true;
}

function flush(): void {
  if (isFlushing) return;
  isFlushing = true;
  isFlushScheduled = false;
  
  const startTime = performance.now();
  
  try {
    processQueue(immediateQueue, Infinity, startTime);
    processQueue(highQueue, FRAME_BUDGET_MS, startTime);
    processQueue(normalQueue, FRAME_BUDGET_MS, startTime);
    processQueue(lowQueue, FRAME_BUDGET_MS, startTime);
    
    if (performance.now() - startTime < IDLE_BUDGET_MS && idleQueue.length > 0) {
      const task = idleQueue.shift()!;
      if (!task.cancelled) {
        try {
          task.task();
        } catch (e) {
          console.error('Idle task execution error:', e);
        }
      }
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
  const scheduledTask: ScheduledTask = { task, priority, id, cancelled: false };
  const queue = getQueue(priority);
  queue.push(scheduledTask);
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

export function cancelTask(id: number): boolean {
  const allQueues = [immediateQueue, highQueue, normalQueue, lowQueue, idleQueue];
  for (const queue of allQueues) {
    const task = queue.find(t => t.id === id);
    if (task) {
      task.cancelled = true;
      return true;
    }
  }
  return false;
}

export function flushSync(): void {
  isFlushScheduled = false;
  
  const allQueues = [immediateQueue, highQueue, normalQueue, lowQueue, idleQueue];
  for (const queue of allQueues) {
    while (queue.length > 0) {
      const task = queue.shift()!;
      if (!task.cancelled) {
        try {
          task.task();
        } catch (e) {
          console.error('FlushSync task error:', e);
        }
      }
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

export function nextFrame(): Promise<number> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(resolve);
    } else {
      setTimeout(() => resolve(performance.now()), 16);
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

export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  return (...args: Parameters<T>): void => {
    const now = performance.now();
    const remaining = wait - (now - lastTime);
    lastArgs = args;
    
    if (remaining <= 0) {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastTime = now;
      fn(...args);
    } else if (timeoutId === null) {
      timeoutId = setTimeout(() => {
        lastTime = performance.now();
        timeoutId = null;
        if (lastArgs) {
          fn(...lastArgs);
        }
      }, remaining);
    }
  };
}

export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, wait);
  };
}

export function batch(tasks: Task[]): Promise<void> {
  return new Promise((resolve) => {
    let completed = 0;
    const total = tasks.length;
    
    if (total === 0) {
      resolve();
      return;
    }
    
    for (const task of tasks) {
      schedule(() => {
        task();
        completed++;
        if (completed === total) {
          resolve();
        }
      }, 'normal');
    }
  });
}

export function runAfterPaint(task: Task): void {
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        task();
      });
    });
  } else {
    setTimeout(task, 32);
  }
}

export function whenIdle(task: Task, timeout?: number): number {
  if (typeof requestIdleCallback !== 'undefined') {
    return requestIdleCallback(() => task(), timeout ? { timeout } : undefined);
  }
  return setTimeout(task, timeout || 100) as unknown as number;
}

export function cancelIdle(id: number): void {
  if (typeof cancelIdleCallback !== 'undefined') {
    cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

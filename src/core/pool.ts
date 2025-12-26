export interface ObjectPool<T> {
  acquire: () => T;
  release: (obj: T) => void;
  clear: () => void;
  size: () => number;
  available: () => number;
}

export function createObjectPool<T>(
  factory: () => T,
  reset: (obj: T) => void,
  initialSize: number = 0,
  maxSize: number = 1000
): ObjectPool<T> {
  const pool: T[] = [];
  let totalCreated = 0;

  for (let i = 0; i < initialSize; i++) {
    pool.push(factory());
    totalCreated++;
  }

  return {
    acquire: (): T => {
      if (pool.length > 0) {
        return pool.pop()!;
      }
      totalCreated++;
      return factory();
    },
    release: (obj: T): void => {
      if (pool.length < maxSize) {
        reset(obj);
        pool.push(obj);
      }
    },
    clear: (): void => {
      pool.length = 0;
    },
    size: (): number => totalCreated,
    available: (): number => pool.length
  };
}

export interface ChunkData {
  name: string;
  startTime: number;
  endTime: number;
  blobRef: Blob | null;
}

const chunkDataPool = createObjectPool<ChunkData>(
  () => ({ name: '', startTime: 0, endTime: 0, blobRef: null }),
  (obj) => {
    obj.name = '';
    obj.startTime = 0;
    obj.endTime = 0;
    obj.blobRef = null;
  },
  32,
  256
);

export function acquireChunkData(): ChunkData {
  return chunkDataPool.acquire();
}

export function releaseChunkData(chunk: ChunkData): void {
  chunkDataPool.release(chunk);
}

export function clearChunkDataPool(): void {
  chunkDataPool.clear();
}

export function createBitset(size: number): Uint32Array {
  const length = Math.ceil(size / 32);
  return new Uint32Array(length);
}

export function setBit(bitset: Uint32Array, index: number): void {
  const wordIndex = index >>> 5;
  const bitIndex = index & 31;
  bitset[wordIndex] |= (1 << bitIndex);
}

export function clearBit(bitset: Uint32Array, index: number): void {
  const wordIndex = index >>> 5;
  const bitIndex = index & 31;
  bitset[wordIndex] &= ~(1 << bitIndex);
}

export function testBit(bitset: Uint32Array, index: number): boolean {
  const wordIndex = index >>> 5;
  const bitIndex = index & 31;
  return (bitset[wordIndex] & (1 << bitIndex)) !== 0;
}

export function countSetBits(bitset: Uint32Array): number {
  let count = 0;
  const len = bitset.length;
  for (let i = 0; i < len; i++) {
    let n = bitset[i];
    n = n - ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    n = (n + (n >>> 4)) & 0x0f0f0f0f;
    n = n + (n >>> 8);
    n = n + (n >>> 16);
    count += n & 0x3f;
  }
  return count;
}

export function calculateProgressFromBitset(bitset: Uint32Array, total: number): number {
  if (total === 0) return 100;
  const completed = countSetBits(bitset);
  return (completed / total) * 100;
}

export interface ProgressTracker {
  bitset: Uint32Array;
  total: number;
  markComplete: (index: number) => void;
  getCompleted: () => number;
  getProgress: () => number;
  reset: () => void;
}

export function createProgressTracker(totalItems: number): ProgressTracker {
  const bitset = createBitset(totalItems);
  
  return {
    bitset,
    total: totalItems,
    markComplete: (index: number): void => {
      setBit(bitset, index);
    },
    getCompleted: (): number => {
      return countSetBits(bitset);
    },
    getProgress: (): number => {
      return calculateProgressFromBitset(bitset, totalItems);
    },
    reset: (): void => {
      bitset.fill(0);
    }
  };
}

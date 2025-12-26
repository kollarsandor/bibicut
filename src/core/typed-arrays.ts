export interface TypedArrayPool {
  getInt32: (size: number) => Int32Array;
  getFloat64: (size: number) => Float64Array;
  getUint8: (size: number) => Uint8Array;
  getUint32: (size: number) => Uint32Array;
  getFloat32: (size: number) => Float32Array;
  release: (array: ArrayBufferView) => void;
  clear: () => void;
  stats: () => { int32: number; float64: number; uint8: number; uint32: number; float32: number };
}

const int32Pool: Int32Array[] = [];
const float64Pool: Float64Array[] = [];
const uint8Pool: Uint8Array[] = [];
const uint32Pool: Uint32Array[] = [];
const float32Pool: Float32Array[] = [];

const MAX_POOL_SIZE = 32;

function getFromPool<T extends ArrayBufferView>(
  pool: T[],
  size: number,
  create: (size: number) => T
): T {
  const len = pool.length;
  for (let i = 0; i < len; i++) {
    if ((pool[i] as unknown as { length: number }).length >= size) {
      const arr = pool.splice(i, 1)[0];
      return (arr as unknown as { subarray: (start: number, end: number) => T }).subarray(0, size);
    }
  }
  return create(size);
}

function releaseToPool<T extends ArrayBufferView>(pool: T[], array: T): void {
  if (pool.length < MAX_POOL_SIZE) {
    pool.push(array);
  }
}

export const typedArrayPool: TypedArrayPool = {
  getInt32: (size: number): Int32Array => getFromPool(int32Pool, size, (s) => new Int32Array(s)),
  getFloat64: (size: number): Float64Array => getFromPool(float64Pool, size, (s) => new Float64Array(s)),
  getUint8: (size: number): Uint8Array => getFromPool(uint8Pool, size, (s) => new Uint8Array(s)),
  getUint32: (size: number): Uint32Array => getFromPool(uint32Pool, size, (s) => new Uint32Array(s)),
  getFloat32: (size: number): Float32Array => getFromPool(float32Pool, size, (s) => new Float32Array(s)),
  
  release: (array: ArrayBufferView): void => {
    if (array instanceof Int32Array) {
      releaseToPool(int32Pool, array);
    } else if (array instanceof Float64Array) {
      releaseToPool(float64Pool, array);
    } else if (array instanceof Uint8Array) {
      releaseToPool(uint8Pool, array);
    } else if (array instanceof Uint32Array) {
      releaseToPool(uint32Pool, array);
    } else if (array instanceof Float32Array) {
      releaseToPool(float32Pool, array);
    }
  },
  
  clear: (): void => {
    int32Pool.length = 0;
    float64Pool.length = 0;
    uint8Pool.length = 0;
    uint32Pool.length = 0;
    float32Pool.length = 0;
  },
  
  stats: () => ({
    int32: int32Pool.length,
    float64: float64Pool.length,
    uint8: uint8Pool.length,
    uint32: uint32Pool.length,
    float32: float32Pool.length
  })
};

export function filterWithBitmap<T>(
  items: T[],
  predicate: (item: T, index: number) => boolean
): T[] {
  const len = items.length;
  if (len === 0) return [];
  
  const bitmapSize = (len + 31) >>> 5;
  const bitmap = new Uint32Array(bitmapSize);
  let count = 0;
  
  for (let i = 0; i < len; i++) {
    if (predicate(items[i], i)) {
      bitmap[i >>> 5] |= 1 << (i & 31);
      count++;
    }
  }
  
  if (count === 0) return [];
  if (count === len) return items.slice();
  
  const result: T[] = new Array(count);
  let resultIndex = 0;
  
  for (let i = 0; i < len; i++) {
    if (bitmap[i >>> 5] & (1 << (i & 31))) {
      result[resultIndex++] = items[i];
    }
  }
  
  return result;
}

export function sortWithIndices<T>(
  items: T[],
  compareFn: (a: T, b: T) => number
): T[] {
  const len = items.length;
  if (len <= 1) return items.slice();
  
  const indices = new Int32Array(len);
  for (let i = 0; i < len; i++) {
    indices[i] = i;
  }
  
  const indexArray = Array.from(indices);
  indexArray.sort((a, b) => compareFn(items[a], items[b]));
  
  const result: T[] = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = items[indexArray[i]];
  }
  
  return result;
}

export function binarySearch(
  array: Int32Array | Float64Array | Uint32Array | Float32Array,
  target: number,
  start: number = 0,
  end: number = array.length - 1
): number {
  while (start <= end) {
    const mid = (start + end) >>> 1;
    const midValue = array[mid];
    
    if (midValue === target) {
      return mid;
    } else if (midValue < target) {
      start = mid + 1;
    } else {
      end = mid - 1;
    }
  }
  
  return -1;
}

export function findInsertionPoint(
  array: Int32Array | Float64Array | Uint32Array | Float32Array,
  value: number,
  start: number = 0,
  end: number = array.length
): number {
  while (start < end) {
    const mid = (start + end) >>> 1;
    if (array[mid] < value) {
      start = mid + 1;
    } else {
      end = mid;
    }
  }
  return start;
}

export function sumTypedArray(array: Int32Array | Float64Array | Uint32Array | Float32Array): number {
  let sum = 0;
  const len = array.length;
  const remainder = len & 7;
  const loopEnd = len - remainder;
  
  for (let i = 0; i < loopEnd; i += 8) {
    sum += array[i] + array[i + 1] + array[i + 2] + array[i + 3] +
           array[i + 4] + array[i + 5] + array[i + 6] + array[i + 7];
  }
  
  for (let i = loopEnd; i < len; i++) {
    sum += array[i];
  }
  
  return sum;
}

export function maxTypedArray(array: Int32Array | Float64Array | Uint32Array | Float32Array): number {
  const len = array.length;
  if (len === 0) return -Infinity;
  
  let max = array[0];
  for (let i = 1; i < len; i++) {
    if (array[i] > max) {
      max = array[i];
    }
  }
  
  return max;
}

export function minTypedArray(array: Int32Array | Float64Array | Uint32Array | Float32Array): number {
  const len = array.length;
  if (len === 0) return Infinity;
  
  let min = array[0];
  for (let i = 1; i < len; i++) {
    if (array[i] < min) {
      min = array[i];
    }
  }
  
  return min;
}

export function averageTypedArray(array: Int32Array | Float64Array | Uint32Array | Float32Array): number {
  const len = array.length;
  if (len === 0) return 0;
  return sumTypedArray(array) / len;
}

export function copyTypedArray<T extends Int32Array | Float64Array | Uint8Array | Uint32Array | Float32Array>(
  source: T,
  target: T,
  sourceStart: number = 0,
  targetStart: number = 0,
  length?: number
): void {
  const copyLength = length ?? source.length - sourceStart;
  
  if (source === target && sourceStart < targetStart && targetStart < sourceStart + copyLength) {
    for (let i = copyLength - 1; i >= 0; i--) {
      target[targetStart + i] = source[sourceStart + i];
    }
  } else {
    for (let i = 0; i < copyLength; i++) {
      target[targetStart + i] = source[sourceStart + i];
    }
  }
}

export function fillTypedArray<T extends Int32Array | Float64Array | Uint8Array | Uint32Array | Float32Array>(
  array: T,
  value: number,
  start: number = 0,
  end: number = array.length
): void {
  for (let i = start; i < end; i++) {
    array[i] = value;
  }
}

export function bitwiseAnd(a: Uint32Array, b: Uint32Array, result?: Uint32Array): Uint32Array {
  const len = Math.min(a.length, b.length);
  const output = result || new Uint32Array(len);
  
  for (let i = 0; i < len; i++) {
    output[i] = a[i] & b[i];
  }
  
  return output;
}

export function bitwiseOr(a: Uint32Array, b: Uint32Array, result?: Uint32Array): Uint32Array {
  const len = Math.min(a.length, b.length);
  const output = result || new Uint32Array(len);
  
  for (let i = 0; i < len; i++) {
    output[i] = a[i] | b[i];
  }
  
  return output;
}

export function bitwiseXor(a: Uint32Array, b: Uint32Array, result?: Uint32Array): Uint32Array {
  const len = Math.min(a.length, b.length);
  const output = result || new Uint32Array(len);
  
  for (let i = 0; i < len; i++) {
    output[i] = a[i] ^ b[i];
  }
  
  return output;
}

export function bitwiseNot(array: Uint32Array, result?: Uint32Array): Uint32Array {
  const len = array.length;
  const output = result || new Uint32Array(len);
  
  for (let i = 0; i < len; i++) {
    output[i] = ~array[i];
  }
  
  return output;
}

export function popcount32(n: number): number {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  n = (n + (n >>> 4)) & 0x0f0f0f0f;
  n = n + (n >>> 8);
  n = n + (n >>> 16);
  return n & 0x3f;
}

export function countSetBits(bitmap: Uint32Array): number {
  let count = 0;
  const len = bitmap.length;
  
  for (let i = 0; i < len; i++) {
    count += popcount32(bitmap[i]);
  }
  
  return count;
}

export function setBit(bitmap: Uint32Array, index: number): void {
  bitmap[index >>> 5] |= 1 << (index & 31);
}

export function clearBit(bitmap: Uint32Array, index: number): void {
  bitmap[index >>> 5] &= ~(1 << (index & 31));
}

export function toggleBit(bitmap: Uint32Array, index: number): void {
  bitmap[index >>> 5] ^= 1 << (index & 31);
}

export function testBit(bitmap: Uint32Array, index: number): boolean {
  return (bitmap[index >>> 5] & (1 << (index & 31))) !== 0;
}

export function createBitmap(size: number): Uint32Array {
  return new Uint32Array((size + 31) >>> 5);
}

export function setBits(bitmap: Uint32Array, indices: number[]): void {
  const len = indices.length;
  for (let i = 0; i < len; i++) {
    setBit(bitmap, indices[i]);
  }
}

export function clearBits(bitmap: Uint32Array, indices: number[]): void {
  const len = indices.length;
  for (let i = 0; i < len; i++) {
    clearBit(bitmap, indices[i]);
  }
}

export function getBitIndices(bitmap: Uint32Array, maxIndex: number): number[] {
  const result: number[] = [];
  const wordCount = bitmap.length;
  
  for (let w = 0; w < wordCount; w++) {
    let word = bitmap[w];
    if (word === 0) continue;
    
    const baseIndex = w << 5;
    let bit = 0;
    
    while (word !== 0 && baseIndex + bit < maxIndex) {
      if (word & 1) {
        result.push(baseIndex + bit);
      }
      word >>>= 1;
      bit++;
    }
  }
  
  return result;
}

export function mergeSort<T>(
  items: T[],
  compareFn: (a: T, b: T) => number
): T[] {
  const len = items.length;
  if (len <= 1) return items.slice();
  
  const mid = len >>> 1;
  const left = mergeSort(items.slice(0, mid), compareFn);
  const right = mergeSort(items.slice(mid), compareFn);
  
  const result: T[] = new Array(len);
  let i = 0;
  let j = 0;
  let k = 0;
  
  while (i < left.length && j < right.length) {
    if (compareFn(left[i], right[j]) <= 0) {
      result[k++] = left[i++];
    } else {
      result[k++] = right[j++];
    }
  }
  
  while (i < left.length) {
    result[k++] = left[i++];
  }
  
  while (j < right.length) {
    result[k++] = right[j++];
  }
  
  return result;
}

export function quickSelect<T>(
  items: T[],
  k: number,
  compareFn: (a: T, b: T) => number
): T {
  const arr = items.slice();
  let left = 0;
  let right = arr.length - 1;
  
  while (left < right) {
    const pivot = arr[(left + right) >>> 1];
    let i = left;
    let j = right;
    
    while (i <= j) {
      while (compareFn(arr[i], pivot) < 0) i++;
      while (compareFn(arr[j], pivot) > 0) j--;
      if (i <= j) {
        const temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
        i++;
        j--;
      }
    }
    
    if (j < k) left = i;
    if (k < i) right = j;
  }
  
  return arr[k];
}

export function partialSort<T>(
  items: T[],
  k: number,
  compareFn: (a: T, b: T) => number
): T[] {
  if (k >= items.length) return mergeSort(items, compareFn);
  
  const result: T[] = new Array(k);
  const heap: T[] = items.slice(0, k);
  
  for (let i = (k >>> 1) - 1; i >= 0; i--) {
    heapifyDown(heap, i, k, compareFn);
  }
  
  for (let i = k; i < items.length; i++) {
    if (compareFn(items[i], heap[0]) < 0) {
      heap[0] = items[i];
      heapifyDown(heap, 0, k, compareFn);
    }
  }
  
  for (let i = k - 1; i >= 0; i--) {
    result[i] = heap[0];
    heap[0] = heap[i];
    heapifyDown(heap, 0, i, compareFn);
  }
  
  return result;
}

function heapifyDown<T>(heap: T[], index: number, size: number, compareFn: (a: T, b: T) => number): void {
  while (true) {
    let largest = index;
    const left = (index << 1) + 1;
    const right = left + 1;
    
    if (left < size && compareFn(heap[left], heap[largest]) > 0) {
      largest = left;
    }
    if (right < size && compareFn(heap[right], heap[largest]) > 0) {
      largest = right;
    }
    
    if (largest === index) break;
    
    const temp = heap[index];
    heap[index] = heap[largest];
    heap[largest] = temp;
    index = largest;
  }
}

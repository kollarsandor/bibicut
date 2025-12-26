export interface TypedArrayPool {
  getInt32: (size: number) => Int32Array;
  getFloat64: (size: number) => Float64Array;
  getUint8: (size: number) => Uint8Array;
  release: (array: ArrayBufferView) => void;
  clear: () => void;
}

const int32Pool: Int32Array[] = [];
const float64Pool: Float64Array[] = [];
const uint8Pool: Uint8Array[] = [];

export const typedArrayPool: TypedArrayPool = {
  getInt32: (size: number): Int32Array => {
    for (let i = 0; i < int32Pool.length; i++) {
      if (int32Pool[i].length >= size) {
        return int32Pool.splice(i, 1)[0].subarray(0, size);
      }
    }
    return new Int32Array(size);
  },
  
  getFloat64: (size: number): Float64Array => {
    for (let i = 0; i < float64Pool.length; i++) {
      if (float64Pool[i].length >= size) {
        return float64Pool.splice(i, 1)[0].subarray(0, size);
      }
    }
    return new Float64Array(size);
  },
  
  getUint8: (size: number): Uint8Array => {
    for (let i = 0; i < uint8Pool.length; i++) {
      if (uint8Pool[i].length >= size) {
        return uint8Pool.splice(i, 1)[0].subarray(0, size);
      }
    }
    return new Uint8Array(size);
  },
  
  release: (array: ArrayBufferView): void => {
    if (array instanceof Int32Array) {
      int32Pool.push(array);
    } else if (array instanceof Float64Array) {
      float64Pool.push(array);
    } else if (array instanceof Uint8Array) {
      uint8Pool.push(array);
    }
  },
  
  clear: (): void => {
    int32Pool.length = 0;
    float64Pool.length = 0;
    uint8Pool.length = 0;
  }
};

export function filterWithBitmap<T>(
  items: T[],
  predicate: (item: T, index: number) => boolean
): T[] {
  const len = items.length;
  const bitmapSize = Math.ceil(len / 32);
  const bitmap = new Uint32Array(bitmapSize);
  let count = 0;
  
  for (let i = 0; i < len; i++) {
    if (predicate(items[i], i)) {
      bitmap[i >>> 5] |= 1 << (i & 31);
      count++;
    }
  }
  
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
  array: Int32Array | Float64Array,
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
  array: Int32Array | Float64Array,
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

export function sumTypedArray(array: Int32Array | Float64Array): number {
  let sum = 0;
  const len = array.length;
  const remainder = len & 3;
  const loopEnd = len - remainder;
  
  for (let i = 0; i < loopEnd; i += 4) {
    sum += array[i] + array[i + 1] + array[i + 2] + array[i + 3];
  }
  
  for (let i = loopEnd; i < len; i++) {
    sum += array[i];
  }
  
  return sum;
}

export function maxTypedArray(array: Int32Array | Float64Array): number {
  if (array.length === 0) return -Infinity;
  
  let max = array[0];
  const len = array.length;
  
  for (let i = 1; i < len; i++) {
    if (array[i] > max) {
      max = array[i];
    }
  }
  
  return max;
}

export function minTypedArray(array: Int32Array | Float64Array): number {
  if (array.length === 0) return Infinity;
  
  let min = array[0];
  const len = array.length;
  
  for (let i = 1; i < len; i++) {
    if (array[i] < min) {
      min = array[i];
    }
  }
  
  return min;
}

export function copyTypedArray<T extends Int32Array | Float64Array | Uint8Array>(
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

export function fillTypedArray<T extends Int32Array | Float64Array | Uint8Array>(
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
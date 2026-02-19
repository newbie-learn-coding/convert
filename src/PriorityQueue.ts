type Comparator<T> = (a: T, b: T) => number;

class PriorityQueue<T> {
  private _queue: Array<T>;
  private _size: number = 0;
  private _comparator: Comparator<T> | null;

  constructor(initialCapacity?: number, comparator?: Comparator<T>) {
    const cap = initialCapacity ?? 11;
    if (cap < 1) {
      throw new Error('initial capacity must be greater than or equal to 1');
    }
    this._queue = new Array<T>(cap);
    this._comparator = comparator ?? null;
  }

  private grow() {
    const oldCapacity = this._size;
    // Double size if small; else grow by 50%
    const newCapacity =
      oldCapacity + (oldCapacity < 64 ? oldCapacity + 2 : oldCapacity >> 1);
    if (!Number.isSafeInteger(newCapacity)) {
      throw new Error('capacity out of range');
    }
    this._queue.length = newCapacity;
  }

  private siftup(k: number, item: T): void {
    if (this._comparator !== null) {
      this.siftupUsingComparator(k, item);
    } else {
      this.siftupComparable(k, item);
    }
  }

  /**
   * siftup of heap
   */
  private siftupUsingComparator(k: number, item: T): void {
    const comparator = this._comparator!;
    while (k > 0) {
      const parent = (k - 1) >>> 1;
      const e = this._queue[parent] as T;
      if (comparator(item, e) >= 0) {
        break;
      }
      this._queue[k] = e;
      k = parent;
    }
    this._queue[k] = item;
  }

  private siftupComparable(k: number, item: T): void {
    const itemStr = String(item);
    while (k > 0) {
      const parent = (k - 1) >>> 1;
      const e = this._queue[parent] as T;
      if (itemStr.localeCompare(String(e)) >= 0) {
        break;
      }
      this._queue[k] = e;
      k = parent;
    }
    this._queue[k] = item;
  }

  private sink(k: number, item: T): void {
    if (this._comparator !== null) {
      this.sinkUsingComparator(k, item);
    } else {
      this.sinkComparable(k, item);
    }
  }

  private sinkUsingComparator(k: number, item: T): void {
    const comparator = this._comparator!;
    const half = this._size >>> 1;
    while (k < half) {
      let child = (k << 1) + 1;
      let object = this._queue[child];
      const right = child + 1;
      if (
        right < this._size &&
        comparator(object, this._queue[right]) > 0
      ) {
        object = this._queue[(child = right)];
      }
      if (comparator(item, object) <= 0) {
        break;
      }
      this._queue[k] = object!;
      k = child;
    }
    this._queue[k] = item;
  }

  private sinkComparable(k: number, item: T): void {
    const itemStr = String(item);
    const half = this._size >>> 1;
    while (k < half) {
      let child = (k << 1) + 1;
      let object = this._queue[child];
      const right = child + 1;

      if (
        right < this._size &&
        String(object).localeCompare(String(this._queue[right])) > 0
      ) {
        object = this._queue[(child = right)];
      }
      if (itemStr.localeCompare(String(object)) <= 0) {
        break;
      }
      this._queue[k] = object!;
      k = child;
    }
    this._queue[k] = item;
  }

  private indexOf(item: T): number {
    for (let i = 0; i < this._size; i++) {
      if (this._queue[i] === item) {
        return i;
      }
    }
    return -1;
  }

  public add(item: T): boolean {
    let i = this._size;
    if (i >= this._queue.length) {
      this.grow();
    }
    this._size = i + 1;
    if (i === 0) {
      this._queue[0] = item;
    } else {
      this.siftup(i, item);
    }
    return true;
  }

  public poll(): T | null {
    if (this._size === 0) {
      return null;
    }
    const s = --this._size;
    const result = this._queue[0] as T;
    const x = this._queue[s] as T;
    this._queue[s] = undefined as unknown as T;
    if (s !== 0) {
      this.sink(0, x);
    }
    return result;
  }

  public peek(): T | null {
    return this._size === 0 ? null : <T>this._queue[0];
  }

  public contains(item: T): boolean {
    return this.indexOf(item) !== -1;
  }

  public clear(): void {
    this._queue.length = 0;
    this._size = 0;
  }

  public size(): number {
    return this._size;
  }

  public empty(): boolean {
    return this._size === 0;
  }

  public toArray(): Array<T> {
    return this._queue.slice(0, this._size);
  }

  public toString(): string {
    return this.toArray().toString();
  }

  public [Symbol.iterator]() {
    let i = 0;
    return {
      next: () => {
        return {
          done: i == this._size,
          value: <T>this._queue[i++]
        };
      }
    };
  }
}

export default PriorityQueue;
export { PriorityQueue };
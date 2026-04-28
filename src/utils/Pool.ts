/**
 * Generic object pool — avoids GC pressure for frequently-created entities.
 * T must have a `reset()` method for re-initialisation.
 */
export class Pool<T extends { reset(...args: unknown[]): void }> {
  private readonly _free: T[] = [];
  private readonly _factory: () => T;

  constructor(factory: () => T, prealloc = 0) {
    this._factory = factory;
    for (let i = 0; i < prealloc; i++) {
      this._free.push(factory());
    }
  }

  acquire(): T {
    return this._free.length > 0 ? this._free.pop()! : this._factory();
  }

  release(obj: T): void {
    this._free.push(obj);
  }

  get freeCount(): number {
    return this._free.length;
  }
}

/**
 * Test setup: shims for newer built-ins used by the vitest reporter.
 * Node 20 does not implement Map.groupBy / Object.groupBy, which the
 * default reporter uses to print failures; without this the run exits
 * non-zero even when every test passes.
 */
type GroupBy = <T, K>(items: Iterable<T>, keyFn: (item: T, index: number) => K) => Map<K, T[]>;

function groupBy<T, K>(items: Iterable<T>, keyFn: (item: T, index: number) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  let index = 0;
  for (const item of items) {
    const key = keyFn(item, index);
    index += 1;
    const bucket = out.get(key);
    if (bucket) bucket.push(item);
    else out.set(key, [item]);
  }
  return out;
}

const mapCtor = Map as unknown as { groupBy?: GroupBy };
if (typeof mapCtor.groupBy !== 'function') {
  Object.defineProperty(Map, 'groupBy', { value: groupBy, writable: true, configurable: true });
}

const objectCtor = Object as unknown as { groupBy?: GroupBy };
if (typeof objectCtor.groupBy !== 'function') {
  Object.defineProperty(Object, 'groupBy', {
    value: <T, K extends PropertyKey>(items: Iterable<T>, keyFn: (item: T, index: number) => K) =>
      Object.fromEntries(groupBy(items, keyFn)),
    writable: true,
    configurable: true,
  });
}

export {};

//
// lodash style get/set in nested object functions
//
export function get<TResult>(obj: any, path: string[], def?: any): TResult {
  let current = obj;

  const found = path.every((key: string) => {
    if (current[key]) {
      current = current[key];
      return current;
    }
  });

  return found ? current : def;
}
// assert(get({ a: { b: { c: 3 } } }, ['a', 'b', 'c']), 3);
// assert(get({ a: { b: { c: 3 } } }, ['a', 'b', 'c', 'd'], 'nowt'), 'nowt');
// assert(get([null, { thing: [4, 5, 6] }], [1, 'thing', 2]), 6);

export function set(obj: any, path: string[], value: any) {
  let current = obj;
  path.forEach((key, idx) => {
    if (idx === path.length - 1) {
      current[key] = value;
    } else {
      current[key] = current[key] || {};
      current = current[key];
    }
  });
  return obj;
}
// let obj = { a: 1, b: {} };
// set(obj, ['b', 'c'], 3);
// assert.deepEqual(obj, { a: 1, b: { c: 3 } });
// set(obj, ['d', 'e'], []);
// assert.deepEqual(obj, { a: 1, b: { c: 3 }, d: { e: [] } });
//
// lodash style get/set in nested object functions
//
function get(obj, path, def) {
  let current = obj;

  const found = path.every((key) => {
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

function set(obj, path, value) {
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

module.exports = { get, set, wtf: 2 };
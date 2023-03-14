const subs = {};

exports.subscribe = (type, fn) => {
  if (typeof fn !== 'function') throw new Error('HandlerNotAFunction');
  subs[type] = subs[type] || [];
  subs[type].push(fn);
  return () => {
    subs[type] = subs[type].filter(sub => sub !== fn);
  };
};

exports.dispatch = event => {
  const fns = subs[event.type] || [];
  const results = fns.map(fn => fn(event.payload));
  return Promise.all(results);
};

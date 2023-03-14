// @ts-check
const Events = require('./index');

const TYPES = (exports.TYPES = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_TAKEN: 'ORDER_TAKEN',
});

exports.orderCreated = order => {
  Events.dispatch({
    type: TYPES.ORDER_CREATED,
    payload: order,
  });
};
exports.onOrderCreated = fn => Events.subscribe(TYPES.ORDER_CREATED, fn);

exports.orderTaken = order => {
  Events.dispatch({
    type: TYPES.ORDER_TAKEN,
    payload: order,
  });
};
exports.onOrderTaken = fn => Events.subscribe(TYPES.ORDER_TAKEN, fn);

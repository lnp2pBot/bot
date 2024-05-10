// @ts-check
const Events = require('./index');

const TYPES = (exports.TYPES = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_UPDATED: 'ORDER_UPDATED',
});

exports.orderCreated = order => {
  Events.dispatch({
    type: TYPES.ORDER_CREATED,
    payload: order,
  });
};
exports.onOrderCreated = fn => Events.subscribe(TYPES.ORDER_CREATED, fn);

exports.orderUpdated = order => {
  Events.dispatch({
    type: TYPES.ORDER_UPDATED,
    payload: order,
  });
};
exports.onOrderUpdated = fn => Events.subscribe(TYPES.ORDER_UPDATED, fn);

// @ts-check
const Events = require('./index');

const TYPES = (exports.TYPES = {
  COMMUNITY_UPDATED: 'COMMUNITY_UPDATED',
});

exports.communityUpdated = community => {
  Events.dispatch({
    type: TYPES.ORDER_CREATED,
    payload: community,
  });
};
exports.onCommunityUpdated = fn => Events.subscribe(TYPES.ORDER_CREATED, fn);

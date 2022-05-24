const { validateUser } = require('../../validations');

exports.auth = async (ctx, next) => {
  const user = await validateUser(ctx, false);
  if (!user) return false;
  ctx.user = user;
  next();
};

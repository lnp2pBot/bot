const { validateUser, validateAdmin } = require('../validations');

exports.userMiddleware = async (ctx, next) => {
  const user = await validateUser(ctx, false);
  console.log(user);
  if (!user) return false;
  ctx.user = user;

  next();
};

exports.adminMiddleware = async (ctx, next) => {
  const admin = await validateAdmin(ctx);
  if (!admin) return false;
  ctx.admin = admin;

  next();
};

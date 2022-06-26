const { validateUser, validateAdmin } = require('../validations');

exports.userMiddleware = async (ctx, next) => {
  const user = await validateUser(ctx, false);
  if (!user) return false;
  ctx.i18n.locale(user.lang);
  ctx.user = user;

  next();
};

exports.adminMiddleware = async (ctx, next) => {
  const admin = await validateAdmin(ctx);
  if (!admin) return false;
  ctx.i18n.locale(admin.lang);
  ctx.admin = admin;

  next();
};

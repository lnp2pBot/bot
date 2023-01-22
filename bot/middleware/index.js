const commandArgsMiddleware = require('./commands');
const { stageMiddleware } = require('./stage');
const {
  userMiddleware,
  adminMiddleware,
  superAdminMiddleware,
} = require('./user');

module.exports = {
  commandArgsMiddleware,
  stageMiddleware,
  userMiddleware,
  adminMiddleware,
  superAdminMiddleware,
};

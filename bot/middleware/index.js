const commandArgsMiddleware = require('./commands');
const { stageMiddleware } = require('./stage');
const { userMiddleware, adminMiddleware } = require('./user');

module.exports = {
  commandArgsMiddleware,
  stageMiddleware,
  userMiddleware,
  adminMiddleware,
};

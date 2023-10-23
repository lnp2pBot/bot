const path = require('path');
const fs = require('fs');
const { getLanguageFlag } = require('../../../util');
const { logger } = require('../../../logger');
const { showFlagsMessage } = require('./messages');

exports.setlang = async ctx => {
  try {
    const flags = [];
    fs.readdirSync(path.join(__dirname, '../../../locales')).forEach(file => {
      const lang = file.split('.')[0];
      flags.push(getLanguageFlag(lang));
    });
    await showFlagsMessage(ctx, flags, ctx.user.lang);
  } catch (error) {
    logger.error(error);
  }
};

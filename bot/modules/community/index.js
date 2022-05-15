const actions = require('./actions')
const commands = require('./commands')

exports.configure = bot => {
    bot.command('findcomm', commands.findCommunity)

    bot.action(/^communityInfo_([0-9a-f]{24})$/, actions.onCommunityInfo)
    bot.action(/^setCommunity_([0-9a-f]{24})$/, actions.onSetCommunity)
}

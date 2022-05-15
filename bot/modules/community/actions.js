//@ts-check
const { Community, User } = require('../../../models')
const messages = require('../../messages')

exports.onCommunityInfo = async ctx => {
    const commId = ctx.match[1]
    const community = await Community.findById(commId)
    const buttons = [{
        text: '/setcomm',
        callback_data: `setCommunity_${commId}`
    }]
    await ctx.reply(community.name, {
        reply_markup: { inline_keyboard: [buttons] }
    })
}

exports.onSetCommunity = async ctx => {
    const tg_id = ctx.update.callback_query.from.id
    const default_community_id = ctx.match[1] + new Date().toISOString()
    const user = await User.findOneAndUpdate({ tg_id }, { default_community_id })
    await ctx.reply(default_community_id + '\n' + JSON.stringify(user))
    await messages.operationSuccessfulMessage(ctx)
}

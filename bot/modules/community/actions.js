//@ts-check
const { Community, Order, User } = require('../../../models')
const messages = require('../../messages')

exports.onCommunityInfo = async ctx => {
    const commId = ctx.match[1]
    const community = await Community.findById(commId)
    const userCount = await User.count({ default_community_id: commId })
    const orderCount = await Order.count({ community_id: commId })
    
    const row0 = [
        { text: 'Orders 24hs', callback_data: `none` },
        { text: orderCount, callback_data: `none` }
    ]
    const row1 = [
        { text: 'Users', callback_data: `none` },
        { text: userCount, callback_data: `none` }
    ]
    const buttons = [{
        text: 'Utilizar por defecto',
        callback_data: `setCommunity_${commId}`
    }]
    const text = `${community.name}\n@${community.group}`
    await ctx.reply(text, {
        reply_markup: { inline_keyboard: [row0, row1, buttons] }
    })
}

exports.onSetCommunity = async ctx => {
    const tg_id = ctx.update.callback_query.from.id
    const default_community_id = ctx.match[1]
    const user = await User.findOneAndUpdate({ tg_id }, { default_community_id })
    //await ctx.reply(default_community_id + '\n' + JSON.stringify(user))
    await messages.operationSuccessfulMessage(ctx)
}

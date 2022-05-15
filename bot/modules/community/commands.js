//@ts-check
const logger = require('../../../logger');
const { Community, Order } = require("../../../models");
const { parseArgs, getCurrency } = require("../../../util");
const { validateUser } = require("../../validations");

async function findCommunities(currency) {
    const communities = await Community.find({ currencies: currency })
    const orderCount = await getOrderCountByCommunity()
    return communities.map(comm => {
        comm.orders = orderCount[comm.id] || 0
        return comm
    }).sort((a, b) => b.orders - a.orders)
}

exports.findCommunity = async ctx => {
    try {
        const user = await validateUser(ctx, false)
        if (!user) return
        
        const [com, u_fiatCode] = parseArgs(ctx.message.text)
        const currency = getCurrency(u_fiatCode.toUpperCase())
        if (!currency) return ctx.reply('InvalidCurrencyCode')

        const communities = await findCommunities(currency.code)

        const inline_keyboard = communities.map(comm => [{
            text: `@${comm.group} | ${comm.name} | ${comm.currencies.join(',')} | ${comm.orders}`,
            callback_data: `communityInfo_${comm._id}`
        }])
        const res = await ctx.reply('id | name | currencies | orders', {
            reply_markup: { inline_keyboard }
        })
    } catch (error) {
        logger.error(error)
    }
}

async function getOrderCountByCommunity() {
    const data = await Order.aggregate([
        { $group: { _id: "$community_id", total: { $count: {} } } }
    ])
    return data.reduce((sum, item) => {
        sum[item._id] = item.total
        return sum
    }, {})
}

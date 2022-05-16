//@ts-check
const logger = require('../../../logger');
const { Community, Order, User } = require("../../../models");
const { parseArgs, getCurrency } = require("../../../util");
const { validateUser } = require("../../validations");

async function findCommunities(currency) {
    const communities = await Community.find({ currencies: currency })
    //const userCount = await getUserCountByCommunity()
    const orderCount = await getOrderCountByCommunity()
    return communities.map(comm => {
        //comm.users = userCount[comm.id] || 0
        comm.orders = orderCount[comm.id] || 0
        return comm
    })
}

exports.findCommunity = async ctx => {
    try {
        const user = await validateUser(ctx, false)
        if (!user) return

        const [com, u_fiatCode] = parseArgs(ctx.message.text)
        const currency = getCurrency(u_fiatCode.toUpperCase())
        if (!currency) return ctx.reply('InvalidCurrencyCode')

        const communities = await findCommunities(currency.code)
        communities.sort((a, b) => a.orders - b.orders)

        const inline_keyboard = []
        while (communities.length > 0) {
            const lastTwo = communities.splice(-2)
            const lineBtn = lastTwo.reverse().map(comm => ({
                text: `${comm.name}`,
                callback_data: `communityInfo_${comm._id}`
            }))
            inline_keyboard.push(lineBtn)
        }
        const text = 'Selecciona la comunidad'
        const res = await ctx.reply(text, {
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
async function getUserCountByCommunity() {
    const data = await User.aggregate([
        { $group: { _id: "$default_community_id", total: { $count: {} } } }
    ])
    return data.reduce((sum, item) => {
        sum[item._id] = item.total
        return sum
    }, {})
}

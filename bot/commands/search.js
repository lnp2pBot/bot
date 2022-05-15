//@ts-check
const { Community, Order } = require("../../models");
const { parseArgs, getCurrency } = require("../../util");
const { validateUser } = require("../validations");

exports.findCommunity = async function findCommunity(ctx) {
    try {
        const user = await validateUser(ctx, false);
        if (!user) return;

        const [com, u_fiatCode] = parseArgs(ctx.message.text)
        const currency = getCurrency(u_fiatCode.toUpperCase())
        if (!currency) return ctx.reply('InvalidCurrencyCode')

        const communities = await Community.find({ currencies: currency.code })
        const orderCount = await getOrderCountByCommunity()
        const response = communities.map(comm => {
            comm.orders = orderCount[comm.id] || 0
            return comm
        }).sort((a, b) => b.orders - a.orders).map(comm => {
            const currencies = comm.currencies.join(',')
            return `@${comm.group} | ${comm.name} | ${currencies} | ${comm.orders}`
        }).join('\n')
        await ctx.reply('id | name | currencies | orders\n' + response)
    } catch (error) {
        console.log(error);
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

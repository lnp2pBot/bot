//@ts-check
const { Community } = require("../../models");
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
        const response = communities.map(comm => {
            const currencies = comm.currencies.join(',')
            return `@${comm.group} | ${comm.name} | ${currencies}`
        }).join('\n')
        await ctx.reply('id | name | currencies\n' + response)
    } catch (error) {
        console.log(error);
    }
}
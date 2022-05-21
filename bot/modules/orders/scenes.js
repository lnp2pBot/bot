const { Scenes, Markup } = require('telegraf')

const CREATE_ORDER = exports.CREATE_ORDER = 'CREATE_ORDER_WIZARD'

exports.middleware = () => {
    const stage = new Scenes.Stage([
        createOrder
    ])
    return stage.middleware()
}

const createOrder = exports.createOrder = new Scenes.WizardScene(
    CREATE_ORDER,
    async ctx => {
        try {
            const { statusMessage, type, currency, fiatAmount, sats, method } = ctx.wizard.state
            const statusString = `Creating ${type} order ${sats} sats for ${fiatAmount} ${currency}.\n${method}`
            if (!statusMessage) {
                const res = await ctx.reply(statusString)
                ctx.wizard.state.statusMessage = res
            } else {
                await ctx.telegram.editMessageText(statusMessage.chat.id, statusMessage.message_id, null, statusString)
            }
            if (undefined === currency) return createOrderSteps.currency(ctx)
            if (undefined === sats) return createOrderSteps.sats(ctx)
            if (undefined === fiatAmount) return createOrderSteps.fiatAmount(ctx)
            if (undefined === method) return createOrderSteps.method(ctx)

            await ctx.reply('Wizard completed...')
            return ctx.scene.leave()
        } catch (err) {
            await ctx.reply('ERROR|' + err.message)
            return ctx.scene.leave()
        }
    },
    async ctx => {
        try {
            if (ctx.wizard.state.handler) {
                const ret = await ctx.wizard.state.handler(ctx)
                if (!ret) return
                delete ctx.wizard.state.handler
            }
            await ctx.wizard.selectStep(0)
            return ctx.wizard.steps[ctx.wizard.cursor](ctx)
        } catch (err) {
            await ctx.reply('ERROR|' + err.message)
            return ctx.scene.leave()
        }
    }
)
createOrder.command('exit', ctx => ctx.scene.leave())
const createOrderSteps = {
    async currency(ctx) {
        ctx.wizard.state.handler = async ctx => {
            await createOrderHandlers.currency(ctx)
            return await ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id)
        }
        const prompt = await createOrderPrompts.currency(ctx)
        return ctx.wizard.next()
    },
    async fiatAmount(ctx) {
        ctx.wizard.state.handler = async ctx => {
            await createOrderHandlers.fiatAmount(ctx)
            return await ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id)
        }
        const prompt = await createOrderPrompts.fiatAmount(ctx)
        return ctx.wizard.next()
    },
    async method(ctx) {
        ctx.wizard.state.handler = async ctx => {
            await createOrderHandlers.method(ctx)
            return await ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id)
        }
        const prompt = await ctx.reply('Especifique el método de pago')
        return ctx.wizard.next()
    },
    async sats(ctx) {
        ctx.wizard.state.handler = async ctx => {
            await createOrderHandlers.sats(ctx)
            return await ctx.telegram.deleteMessage(prompt.chat.id, prompt.message_id)
        }
        const prompt = await createOrderPrompts.sats(ctx)
        return ctx.wizard.next()
    }
}
const createOrderPrompts = {
    async currency(ctx) {
        const { currencies } = ctx.wizard.state
        const buttons = currencies.map(currency => Markup.button.callback(currency, currency))
        const rows = []
        const chunkSize = 3;
        for (let i = 0; i < buttons.length; i += chunkSize) {
            const chunk = buttons.slice(i, i + chunkSize);
            rows.push(chunk)
        }
        return ctx.reply('Elija una moneda', Markup.inlineKeyboard(rows))
    },
    async fiatAmount(ctx) {
        const { currency } = ctx.wizard.state
        return ctx.reply('Especifique el monto de ' + currency)
    },
    async sats(ctx) {
        return ctx.reply('Especifique el monto de satoshis')
    }
}
const createOrderHandlers = {
    async currency(ctx) {
        if (!ctx.callbackQuery) return
        const currency = ctx.callbackQuery.data
        ctx.wizard.state.currency = currency
        return true
    },
    async fiatAmount(ctx) {
        const input = ctx.message.text
        if (isNaN(input)) {
            await ctx.reply('NaN')
            return
        }
        ctx.wizard.state.fiatAmount = parseInt(input)
        await ctx.telegram.deleteMessage(ctx.message.chat.id, ctx.message.message_id)
        return true
    },
    async method(ctx) {
        const { text } = ctx.message
        if (!text) return
        ctx.wizard.state.method = text
        await ctx.telegram.deleteMessage(ctx.message.chat.id, ctx.message.message_id)
        return true
    },
    async sats(ctx) {
        const input = ctx.message.text
        if (isNaN(input)) {
            await ctx.reply('NaN')
            return
        }
        ctx.wizard.state.sats = parseInt(input)
        await ctx.telegram.deleteMessage(ctx.message.chat.id, ctx.message.message_id)
        return true
    }
}

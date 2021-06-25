const { createHash, randomBytes } = require('crypto');
const { createHodlInvoice, settleHodlInvoice } = require('lightning');
const lnd = require('./connect');

const createHoldInvoice = async ({ description, amount }) => {
  try {
    const randomSecret = () => randomBytes(32);
    const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');

    const secret = randomSecret();

    const id = sha256(secret);
    const { request } = await createHodlInvoice({
      lnd,
      description,
      id,
      tokens: amount
    });
    return { request, hash: id, secret: secret.toString('hex') };
  } catch (e) {
    console.log(e);
    return e;
  }
};

const settleHoldInvoice = async ({ secret }) => {
  try {
    await settleHodlInvoice({ lnd, secret });
  } catch (e) {
    console.log(e);
    return e;
  }
};

module.exports = { createHoldInvoice, settleHoldInvoice };

const { createHash, randomBytes } = require('crypto');
const lightning = require('lightning');
const lnd = require('./connect');

const createHoldInvoice = async ({ description, amount }) => {
  try {
    const randomSecret = () => randomBytes(32);
    const sha256 = buffer => createHash('sha256').update(buffer).digest('hex');
    // We create a random secret
    const secret = randomSecret();

    const hash = sha256(secret);
    const { request, id } = await lightning.createHodlInvoice({
      lnd,
      description,
      id: hash,
      tokens: amount
    });

    // We sent back the response hash (id) to be used on testing
    return { request, hash: id, secret: secret.toString('hex') };
  } catch (e) {
    console.log(e);
    return e;
  }
};

const settleHoldInvoice = async ({ secret }) => {
  try {
    await lightning.settleHodlInvoice({ lnd, secret });
  } catch (e) {
    console.log(e);
    return e;
  }
};

const cancelHoldInvoice = async ({ hash }) => {
  try {
    await lightning.cancelHodlInvoice({ lnd, id: hash });
  } catch (e) {
    console.log(e);
    return e;
  }
};

module.exports = { createHoldInvoice, settleHoldInvoice, cancelHoldInvoice };

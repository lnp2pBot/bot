const order = {
  buyer_dispute: false,
  seller_dispute: false,
  buyer_cooperativecancel: false,
  seller_cooperativecancel: false,
  _id: '612d451148df8353e387eeff',
  description:
    'Vendiendo 111 sats\n' +
    'Por ves 111\n' +
    'Pago por Pagomovil\n' +
    'Tiene 7 operaciones exitosas',
  amount: 111,
  fee: 0.111,
  creator_id: '61006f0e85ad4f96cde94141',
  seller_id: '61006f0e85ad4f96cde94141',
  type: 'sell',
  status: 'PENDING',
  fiat_amount: 111,
  fiat_code: 'ves',
  payment_method: 'Pagomovil',
  tg_chat_id: '1',
  tg_order_message: '1',
  created_at: '2021-08-30T20:52:33.870Z',
};

order.save = () => 'saved';

module.exports = order;

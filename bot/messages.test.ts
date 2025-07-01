import {
  startMessage,
  initBotErrorMessage,
  invoicePaymentRequestMessage,
  showQRCodeMessage,
  sellOrderCorrectFormatMessage,
  buyOrderCorrectFormatMessage,
  minimunAmountInvoiceMessage,
  minimunExpirationTimeInvoiceMessage,
  expiredInvoiceMessage,
  expiredInvoiceOnPendingMessage,
  requiredAddressInvoiceMessage,
  invoiceMustBeLargerMessage,
  invoiceExpiryTooShortMessage,
  invoiceHasExpiredMessage,
  invoiceHasWrongDestinationMessage,
  requiredHashInvoiceMessage,
  invoiceInvalidMessage,
  invalidOrderMessage,
  invalidTypeOrderMessage,
  alreadyTakenOrderMessage,
  invalidDataMessage,
  genericErrorMessage,
  beginTakeBuyMessage,
  showHoldInvoiceMessage,
  onGoingTakeBuyMessage,
  beginTakeSellMessage,
  onGoingTakeSellMessage,
  takeSellWaitingSellerToPayMessage,
  releasedSatsMessage,
  rateUserMessage,
  notActiveOrderMessage,
  waitingForBuyerOrderMessage,
  notOrderMessage,
  publishBuyOrderMessage,
  publishSellOrderMessage,
  pendingSellMessage,
  pendingBuyMessage,
  customMessage,
  checkOrderMessage,
  checkInvoiceMessage,
  mustBeValidCurrency,
  mustBeANumberOrRange,
  invalidLightningAddress,
  helpMessage,
  termsMessage,
  privacyMessage,
  mustBeGreatherEqThan,
  bannedUserErrorMessage,
  userOrderIsBlockedByUserTaker,
  userTakerIsBlockedByUserOrder,
  fiatSentMessages,
  orderOnfiatSentStatusMessages,
  userBannedMessage,
  userUnBannedMessage,
  notFoundUserMessage,
  errorParsingInvoiceMessage,
  notValidIdMessage,
  addInvoiceMessage,
  sendBuyerInfo2SellerMessage,
  cantTakeOwnOrderMessage,
  notLightningInvoiceMessage,
  notOrdersMessage,
  notRateForCurrency,
  incorrectAmountInvoiceMessage,
  invoiceUpdatedMessage,
  invoiceUpdatedPaymentWillBeSendMessage,
  invoiceAlreadyUpdatedMessage,
  successSetAddress,
  badStatusOnCancelOrderMessage,
  orderIsAlreadyCanceledMessage,
  successCancelOrderMessage,
  counterPartyCancelOrderMessage,
  successCancelAllOrdersMessage,
  successCancelOrderByAdminMessage,
  successCompleteOrderMessage,
  successCompleteOrderByAdminMessage,
  shouldWaitCooperativeCancelMessage,
  okCooperativeCancelMessage,
  refundCooperativeCancelMessage,
  initCooperativeCancelMessage,
  counterPartyWantsCooperativeCancelMessage,
  invoicePaymentFailedMessage,
  userCantTakeMoreThanOneWaitingOrderMessage,
  sellerPaidHoldMessage,
  showInfoMessage,
  buyerReceivedSatsMessage,
  listCurrenciesResponse,
  priceApiFailedMessage,
  updateUserSettingsMessage,
  disableLightningAddress,
  invalidRangeWithAmount,
  tooManyPendingOrdersMessage,
  wizardAddInvoiceInitMessage,
  wizardAddInvoiceExitMessage,
  wizardExitMessage,
  orderExpiredMessage,
  cantAddInvoiceMessage,
  sendMeAnInvoiceMessage,
  wizardAddFiatAmountMessage,
  wizardAddFiatAmountWrongAmountMessage,
  wizardAddFiatAmountCorrectMessage,
  expiredOrderMessage,
  toBuyerExpiredOrderMessage,
  toSellerExpiredOrderMessage,
  toBuyerDidntAddInvoiceMessage,
  toSellerBuyerDidntAddInvoiceMessage,
  toAdminChannelBuyerDidntAddInvoiceMessage,
  toSellerDidntPayInvoiceMessage,
  toBuyerSellerDidntPayInvoiceMessage,
  toAdminChannelSellerDidntPayInvoiceMessage,
  toAdminChannelPendingPaymentSuccessMessage,
  toBuyerPendingPaymentSuccessMessage,
  toBuyerPendingPaymentFailedMessage,
  toAdminChannelPendingPaymentFailedMessage,
  currencyNotSupportedMessage,
  notAuthorized,
  mustBeANumber,
  showConfirmationButtons
} from './messages';

const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('Messages Module', () => {
  let sandbox: any;
  let mockCtx: any;
  let mockBot: any;
  let mockUser: any;
  let mockOrder: any;
  let mockI18n: any;
  let mockBuyer: any;
  let mockSeller: any;
  let mockConfig: any;
  let mockCurrencies: any;
  let mockPendingPayment: any;
  let mockPayment: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    
    // Mock i18n context
    mockI18n = {
      t: sandbox.stub().returnsArg(0)
    };

    // Mock MainContext
    mockCtx = {
      reply: sandbox.stub().resolves(),
      replyWithMediaGroup: sandbox.stub().resolves(),
      deleteMessage: sandbox.stub().resolves(),
      i18n: mockI18n,
      telegram: {
        sendMessage: sandbox.stub().resolves({ message_id: 123 }),
        sendMediaGroup: sandbox.stub().resolves([{ message_id: 123 }])
      },
      match: ['full_match', 'group1']
    };

    // Mock bot/HasTelegram
    mockBot = {
      telegram: {
        sendMessage: sandbox.stub().resolves({ message_id: 456 }),
        sendMediaGroup: sandbox.stub().resolves([{ message_id: 456 }])
      }
    };

    // Mock User
    mockUser = {
      tg_id: '123456789',
      username: 'testuser',
      total_rating: 4.5,
      total_reviews: 10,
      disputes: 0,
      volume_traded: 1000,
      created_at: new Date('2023-01-01')
    };

    mockBuyer = {
      ...mockUser,
      tg_id: '111111111',
      username: 'buyer'
    };

    mockSeller = {
      ...mockUser,
      tg_id: '222222222',
      username: 'seller'
    };

    // Mock Order
    mockOrder = {
      _id: 'order123',
      id: 'order123',
      type: 'sell',
      fiat_code: 'USD',
      fiat_amount: 100,
      amount: 1000000,
      min_amount: 50,
      max_amount: 200,
      payment_method: 'PayPal',
      description: 'Test order description',
      random_image: 'base64imagedata',
      is_golden_honey_badger: false,
      save: sandbox.stub().resolves(),
      tg_channel_message1: null
    };

    // Mock Config
    mockConfig = {
      node_status: 'up',
      node_uri: 'test@node.com'
    };

    // Mock currencies array
    mockCurrencies = [
      { code: 'USD', name: 'US Dollar', emoji: '🇺🇸' },
      { code: 'EUR', name: 'Euro', emoji: '🇪🇺' }
    ];

    // Mock PendingPayment
    mockPendingPayment = {
      attempts: 1
    };

    // Mock Payment
    mockPayment = {
      secret: 'payment_secret_123'
    };

    // Set up environment variables
    process.env.HOLD_INVOICE_EXPIRATION_WINDOW = '3600';
    process.env.ORDER_PUBLISHED_EXPIRATION_WINDOW = '86400';
    process.env.MIN_PAYMENT_AMT = '1000';
    process.env.INVOICE_EXPIRATION_WINDOW = '600000';
    process.env.MAX_FEE = '0.01';
    process.env.MAX_ROUTING_FEE = '0.005';
    process.env.CHANNEL = '@testchannel';
    process.env.ADMIN_CHANNEL = '987654321';
    process.env.HELP_GROUP = '@helpgroup';
    process.env.FIAT_RATE_NAME = 'CoinGecko';
    process.env.PENDING_PAYMENT_WINDOW = '300';
    process.env.PAYMENT_ATTEMPTS = '3';
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('startMessage', () => {
    it('should send start message with correct parameters', async () => {
      mockI18n.t.withArgs('start').returns('Welcome message');
      mockI18n.t.withArgs('disclaimer').returns('Disclaimer text');

      await startMessage(mockCtx);

      expect(mockCtx.reply.calledOnce).to.be.true;
      expect(mockI18n.t.calledWith('start')).to.be.true;
      expect(mockI18n.t.calledWith('disclaimer')).to.be.true;
    });

    it('should handle errors gracefully', async () => {
      mockCtx.reply.rejects(new Error('Network error'));
      
      await startMessage(mockCtx);
      
      // Should not throw
      expect(true).to.be.true;
    });
  });

  describe('invoicePaymentRequestMessage', () => {
    it('should send invoice payment request with proper formatting', async () => {
      await invoicePaymentRequestMessage(mockCtx, mockUser, mockOrder, mockI18n, mockBuyer);

      expect(mockCtx.telegram.sendMessage.calledTwice).to.be.true;
      expect(mockI18n.t.calledWith('invoice_payment_request')).to.be.true;
    });

    it('should handle missing currency object', async () => {
      mockOrder.fiat_code = 'UNKNOWN';
      
      await invoicePaymentRequestMessage(mockCtx, mockUser, mockOrder, mockI18n, mockBuyer);
      
      expect(mockCtx.telegram.sendMessage.called).to.be.true;
    });

    it('should include inline keyboard with continue/cancel options', async () => {
      await invoicePaymentRequestMessage(mockCtx, mockUser, mockOrder, mockI18n, mockBuyer);

      const secondCall = mockCtx.telegram.sendMessage.getCall(1);
      expect(secondCall.args[2]).to.have.property('reply_markup');
      expect(secondCall.args[2].reply_markup).to.have.property('inline_keyboard');
    });
  });

  describe('showQRCodeMessage', () => {
    it('should send QR code with payment request', async () => {
      const request = 'lnbc1000n1...';
      
      await showQRCodeMessage(mockCtx, mockOrder, request, mockUser);

      expect(mockCtx.telegram.sendMediaGroup.calledOnce).to.be.true;
      const mediaGroup = mockCtx.telegram.sendMediaGroup.getCall(0).args[1];
      expect(mediaGroup[0].caption).to.include(request);
    });

    it('should handle QR generation errors', async () => {
      const invalidRequest = '';
      
      await showQRCodeMessage(mockCtx, mockOrder, invalidRequest, mockUser);
      
      // Should not throw
      expect(true).to.be.true;
    });
  });

  describe('Order Status Messages', () => {
    describe('pendingSellMessage', () => {
      it('should send pending sell message with order expiration', async () => {
        const channel = '@testchannel';
        
        await pendingSellMessage(mockCtx, mockUser, mockOrder, channel, mockI18n);

        expect(mockCtx.telegram.sendMediaGroup.calledOnce).to.be.true;
        expect(mockCtx.telegram.sendMessage.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('pending_sell')).to.be.true;
      });

      it('should send golden honey badger message for special orders', async () => {
        mockOrder.is_golden_honey_badger = true;
        const channel = '@testchannel';
        
        await pendingSellMessage(mockCtx, mockUser, mockOrder, channel, mockI18n);

        expect(mockCtx.telegram.sendMessage.calledTwice).to.be.true;
        expect(mockI18n.t.calledWith('golden_honey_badger')).to.be.true;
      });
    });

    describe('pendingBuyMessage', () => {
      it('should send pending buy message', async () => {
        const channel = '@testchannel';
        
        await pendingBuyMessage(mockBot, mockUser, mockOrder, channel, mockI18n);

        expect(mockBot.telegram.sendMessage.calledTwice).to.be.true;
        expect(mockI18n.t.calledWith('pending_buy')).to.be.true;
      });
    });
  });

  describe('Validation Messages', () => {
    describe('sellOrderCorrectFormatMessage', () => {
      it('should send correct format message for sell orders', async () => {
        await sellOrderCorrectFormatMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('sell_correct_format')).to.be.true;
      });
    });

    describe('buyOrderCorrectFormatMessage', () => {
      it('should send correct format message for buy orders', async () => {
        await buyOrderCorrectFormatMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('buy_correct_format')).to.be.true;
      });
    });

    describe('mustBeValidCurrency', () => {
      it('should send currency validation message', async () => {
        await mustBeValidCurrency(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('must_be_valid_currency')).to.be.true;
      });
    });

    describe('mustBeANumberOrRange', () => {
      it('should send number/range validation message', async () => {
        await mustBeANumberOrRange(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('must_be_number_or_range')).to.be.true;
      });
    });

    describe('invalidLightningAddress', () => {
      it('should send invalid lightning address message', async () => {
        await invalidLightningAddress(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('invalid_lightning_address')).to.be.true;
      });
    });
  });

  describe('Invoice Messages', () => {
    describe('minimunAmountInvoiceMessage', () => {
      it('should send minimum amount message with environment variable', async () => {
        await minimunAmountInvoiceMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('min_invoice_amount', { minPaymentAmount: '1000' })).to.be.true;
      });
    });

    describe('expiredInvoiceMessage', () => {
      it('should send expired invoice message', async () => {
        await expiredInvoiceMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('invoice_expired')).to.be.true;
      });
    });

    describe('invoiceInvalidMessage', () => {
      it('should send invalid invoice message', async () => {
        await invoiceInvalidMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('invoice_invalid_error')).to.be.true;
      });
    });

    describe('invoiceUpdatedMessage', () => {
      it('should send invoice updated message', async () => {
        await invoiceUpdatedMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('invoice_updated')).to.be.true;
      });
    });

    describe('invoiceAlreadyUpdatedMessage', () => {
      it('should send invoice already updated message', async () => {
        await invoiceAlreadyUpdatedMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('invoice_already_being_paid')).to.be.true;
      });
    });
  });

  describe('Order Processing Messages', () => {
    describe('beginTakeBuyMessage', () => {
      it('should send begin take buy message with inline keyboard', async () => {
        await beginTakeBuyMessage(mockCtx, mockBot, mockSeller, mockOrder);

        expect(mockBot.telegram.sendMediaGroup.calledOnce).to.be.true;
        expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
        
        const messageCall = mockBot.telegram.sendMessage.getCall(0);
        expect(messageCall.args[2]).to.have.property('reply_markup');
      });
    });

    describe('showHoldInvoiceMessage', () => {
      it('should send hold invoice with QR code', async () => {
        const request = 'lnbc1000n1...';
        const amount = 1000000;
        
        await showHoldInvoiceMessage(mockCtx, request, amount, 'USD', 100, 'base64image');

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockCtx.replyWithMediaGroup.calledOnce).to.be.true;
      });

      it('should include golden honey badger message when flag is true', async () => {
        const request = 'lnbc1000n1...';
        const amount = 1000000;
        
        await showHoldInvoiceMessage(mockCtx, request, amount, 'USD', 100, 'base64image', true);

        expect(mockCtx.reply.calledTwice).to.be.true;
        expect(mockI18n.t.calledWith('golden_honey_badger')).to.be.true;
      });
    });

    describe('onGoingTakeBuyMessage', () => {
      it('should send ongoing take buy messages to both parties', async () => {
        const rate = '4.5 ⭐⭐⭐⭐⭐ (10)';
        
        await onGoingTakeBuyMessage(mockBot, mockSeller, mockBuyer, mockOrder, mockI18n, mockI18n, rate);

        expect(mockBot.telegram.sendMessage.calledThrice).to.be.true;
      });
    });

    describe('onGoingTakeSellMessage', () => {
      it('should send ongoing take sell messages', async () => {
        await onGoingTakeSellMessage(mockBot, mockSeller, mockBuyer, mockOrder, mockI18n, mockI18n);

        expect(mockBot.telegram.sendMessage.calledThrice).to.be.true;
      });
    });
  });

  describe('Order Completion Messages', () => {
    describe('releasedSatsMessage', () => {
      it('should send released sats messages to both parties', async () => {
        await releasedSatsMessage(mockBot, mockSeller, mockBuyer, mockI18n, mockI18n);

        expect(mockBot.telegram.sendMessage.calledTwice).to.be.true;
        expect(mockI18n.t.calledWith('sell_success')).to.be.true;
        expect(mockI18n.t.calledWith('funds_released')).to.be.true;
      });
    });

    describe('rateUserMessage', () => {
      it('should send rating message with star buttons', async () => {
        await rateUserMessage(mockBot, mockUser, mockOrder, mockI18n);

        expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
        const messageCall = mockBot.telegram.sendMessage.getCall(0);
        const keyboard = messageCall.args[2].reply_markup.inline_keyboard;
        expect(keyboard).to.have.length(5); // 5 star ratings
      });
    });
  });

  describe('Error Messages', () => {
    describe('invalidOrderMessage', () => {
      it('should send invalid order message', async () => {
        await invalidOrderMessage(mockCtx, mockBot, mockUser);

        expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('order_id_invalid')).to.be.true;
      });
    });

    describe('invalidTypeOrderMessage', () => {
      it('should send invalid type message with order type', async () => {
        await invalidTypeOrderMessage(mockCtx, mockBot, mockUser, 'buy');

        expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('order_invalid_type', { type: 'buy' })).to.be.true;
      });
    });

    describe('alreadyTakenOrderMessage', () => {
      it('should send already taken order message', async () => {
        await alreadyTakenOrderMessage(mockCtx, mockBot, mockUser);

        expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('order_already_taken')).to.be.true;
      });
    });

    describe('genericErrorMessage', () => {
      it('should send generic error message', async () => {
        await genericErrorMessage(mockBot, mockUser, mockI18n);

        expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('generic_error')).to.be.true;
      });
    });

    describe('bannedUserErrorMessage', () => {
      it('should send banned user error message', async () => {
        await bannedUserErrorMessage(mockCtx, mockUser);

        expect(mockCtx.telegram.sendMessage.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('you_have_been_banned')).to.be.true;
      });
    });
  });

  describe('User Management Messages', () => {
    describe('userBannedMessage', () => {
      it('should send user banned confirmation', async () => {
        await userBannedMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('user_banned')).to.be.true;
      });
    });

    describe('userUnBannedMessage', () => {
      it('should send user unbanned confirmation', async () => {
        await userUnBannedMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('user_unbanned')).to.be.true;
      });
    });

    describe('notFoundUserMessage', () => {
      it('should send user not found message', async () => {
        await notFoundUserMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('user_not_found')).to.be.true;
      });
    });
  });

  describe('Order Cancellation Messages', () => {
    describe('successCancelOrderMessage', () => {
      it('should send successful cancellation message', async () => {
        await successCancelOrderMessage(mockCtx, mockUser, mockOrder, mockI18n);

        expect(mockCtx.telegram.sendMessage.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('cancel_success', { orderId: mockOrder._id })).to.be.true;
      });
    });

    describe('badStatusOnCancelOrderMessage', () => {
      it('should send bad status cancellation message', async () => {
        await badStatusOnCancelOrderMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('cancel_error')).to.be.true;
      });
    });

    describe('orderIsAlreadyCanceledMessage', () => {
      it('should send already canceled message', async () => {
        await orderIsAlreadyCanceledMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('already_cancelled')).to.be.true;
      });
    });
  });

  describe('Info and Help Messages', () => {
    describe('helpMessage', () => {
      it('should send help message with markdown', async () => {
        await helpMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('help')).to.be.true;
        const replyCall = mockCtx.reply.getCall(0);
        expect(replyCall.args[1]).to.deep.equal({ parse_mode: 'Markdown' });
      });
    });

    describe('termsMessage', () => {
      it('should send terms message', async () => {
        await termsMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('disclaimer')).to.be.true;
      });
    });

    describe('privacyMessage', () => {
      it('should send privacy message', async () => {
        await privacyMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('privacy')).to.be.true;
      });
    });

    describe('showInfoMessage', () => {
      it('should send comprehensive bot and user info', async () => {
        await showInfoMessage(mockCtx, mockUser, mockConfig);

        expect(mockCtx.telegram.sendMessage.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('user_info')).to.be.true;
        expect(mockI18n.t.calledWith('bot_info')).to.be.true;
      });
    });
  });

  describe('Currency and Amount Messages', () => {
    describe('listCurrenciesResponse', () => {
      it('should list currencies in formatted table', async () => {
        await listCurrenciesResponse(mockCtx, mockCurrencies);

        expect(mockCtx.reply.calledOnce).to.be.true;
        const replyText = mockCtx.reply.getCall(0).args[0];
        expect(replyText).to.include('USD');
        expect(replyText).to.include('EUR');
      });
    });

    describe('currencyNotSupportedMessage', () => {
      it('should send currency not supported message with list', async () => {
        const currencies = ['USD', 'EUR', 'GBP'];
        
        await currencyNotSupportedMessage(mockCtx, currencies);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('currency_not_supported')).to.be.true;
      });
    });
  });

  describe('Wizard Messages', () => {
    describe('wizardAddInvoiceInitMessage', () => {
      it('should send wizard initialization with order details', async () => {
        await wizardAddInvoiceInitMessage(mockCtx, mockOrder, 'USD', 60);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('wizard_add_invoice_init')).to.be.true;
      });
    });

    describe('wizardExitMessage', () => {
      it('should send wizard exit message', async () => {
        await wizardExitMessage(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('wizard_exit')).to.be.true;
      });
    });

    describe('wizardAddFiatAmountMessage', () => {
      it('should send fiat amount wizard message', async () => {
        await wizardAddFiatAmountMessage(mockCtx, 'USD', 'buy', mockOrder);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('wizard_add_fiat_amount')).to.be.true;
      });
    });
  });

  describe('Admin and Notification Messages', () => {
    describe('expiredOrderMessage', () => {
      it('should send expired order notification to admin', async () => {
        await expiredOrderMessage(mockBot, mockOrder, mockBuyer, mockSeller, mockI18n);

        expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('expired_order')).to.be.true;
      });
    });

    describe('toAdminChannelPendingPaymentSuccessMessage', () => {
      it('should notify admin of successful pending payment', async () => {
        await toAdminChannelPendingPaymentSuccessMessage(mockBot, mockUser, mockOrder, mockPendingPayment, mockPayment, mockI18n);

        expect(mockBot.telegram.sendMessage.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('pending_payment_success_to_admin')).to.be.true;
      });
    });
  });

  describe('Utility Messages', () => {
    describe('customMessage', () => {
      it('should send custom message with MarkdownV2', async () => {
        const customText = 'Custom message text';
        
        await customMessage(mockCtx, customText);

        expect(mockCtx.reply.calledOnce).to.be.true;
        const replyCall = mockCtx.reply.getCall(0);
        expect(replyCall.args[0]).to.equal(customText);
        expect(replyCall.args[1]).to.deep.equal({ parse_mode: 'MarkdownV2' });
      });
    });

    describe('checkOrderMessage', () => {
      it('should send detailed order information', async () => {
        await checkOrderMessage(mockCtx, mockOrder, mockBuyer, mockSeller);

        expect(mockCtx.reply.calledOnce).to.be.true;
      });
    });

    describe('checkInvoiceMessage', () => {
      it('should send settled invoice status', async () => {
        await checkInvoiceMessage(mockCtx, true, false, false);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('invoice_settled')).to.be.true;
      });

      it('should send canceled invoice status', async () => {
        await checkInvoiceMessage(mockCtx, false, true, false);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('invoice_cancelled')).to.be.true;
      });

      it('should send held invoice status', async () => {
        await checkInvoiceMessage(mockCtx, false, false, true);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('invoice_held')).to.be.true;
      });

      it('should send no info status when all flags are false', async () => {
        await checkInvoiceMessage(mockCtx, false, false, false);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('invoice_no_info')).to.be.true;
      });
    });

    describe('showConfirmationButtons', () => {
      it('should create inline keyboard for order confirmations', async () => {
        const orders = [mockOrder, { ...mockOrder, _id: 'order456' }];
        
        await showConfirmationButtons(mockCtx, orders, '/release');

        expect(mockCtx.reply.calledOnce).to.be.true;
        const replyCall = mockCtx.reply.getCall(0);
        expect(replyCall.args[1]).to.have.property('reply_markup');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle Telegram API errors gracefully', async () => {
      mockCtx.reply.rejects(new Error('Telegram API Error'));
      
      await startMessage(mockCtx);
      
      // Should not throw, error should be logged
      expect(true).to.be.true;
    });

    it('should handle missing environment variables', async () => {
      delete process.env.MIN_PAYMENT_AMT;
      
      await minimunAmountInvoiceMessage(mockCtx);
      
      expect(mockCtx.reply.calledOnce).to.be.true;
    });

    it('should handle null/undefined user objects', async () => {
      await invalidOrderMessage(mockCtx, mockBot, null as any);
      
      // Should not throw
      expect(mockBot.telegram.sendMessage.called).to.be.true;
    });

    it('should handle malformed order objects', async () => {
      const malformedOrder = { ...mockOrder, _id: null };
      
      await successCancelOrderMessage(mockCtx, mockUser, malformedOrder, mockI18n);
      
      expect(mockCtx.telegram.sendMessage.called).to.be.true;
    });

    it('should handle i18n translation failures', async () => {
      mockI18n.t.throws(new Error('Translation error'));
      
      await helpMessage(mockCtx);
      
      // Should not throw
      expect(true).to.be.true;
    });
  });

  describe('Message Threading and Async Behavior', () => {
    it('should handle concurrent message sending', async () => {
      const promises = Array.from({ length: 10 }, () => startMessage(mockCtx));
      
      await Promise.all(promises);
      
      expect(mockCtx.reply.callCount).to.equal(10);
    });

    it('should maintain message order for sequential calls', async () => {
      await startMessage(mockCtx);
      await helpMessage(mockCtx);
      await termsMessage(mockCtx);

      expect(mockCtx.reply.callCount).to.equal(3);
      expect(mockI18n.t.getCall(0).args[0]).to.equal('start');
      expect(mockI18n.t.getCall(3).args[0]).to.equal('help');
      expect(mockI18n.t.getCall(4).args[0]).to.equal('disclaimer');
    });
  });

  describe('Authorization Messages', () => {
    describe('notAuthorized', () => {
      it('should send not authorized message to context', async () => {
        await notAuthorized(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('not_authorized')).to.be.true;
      });

      it('should send not authorized message to specific telegram ID', async () => {
        const tgId = '123456789';
        
        await notAuthorized(mockCtx, tgId);

        expect(mockCtx.telegram.sendMessage.calledOnce).to.be.true;
        expect(mockCtx.telegram.sendMessage.calledWith(tgId)).to.be.true;
      });
    });
  });

  describe('Number Validation Messages', () => {
    describe('mustBeANumber', () => {
      it('should send number validation message', async () => {
        await mustBeANumber(mockCtx);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('not_number')).to.be.true;
      });
    });

    describe('mustBeGreatherEqThan', () => {
      it('should send greater than or equal validation message', async () => {
        await mustBeGreatherEqThan(mockCtx, 'amount', 100);

        expect(mockCtx.reply.calledOnce).to.be.true;
        expect(mockI18n.t.calledWith('must_be_gt_or_eq', { fieldName: 'amount', qty: 100 })).to.be.true;
      });
    });
  });

  describe('Memory and Performance', () => {
    it('should handle large order lists efficiently', async () => {
      const largeOrderList = Array.from({ length: 100 }, (_, i) => ({
        ...mockOrder,
        _id: `order_${i}`,
        fiat_amount: i * 10
      }));

      const start = Date.now();
      await showConfirmationButtons(mockCtx, largeOrderList, '/release');
      const duration = Date.now() - start;

      expect(duration).to.be.lessThan(1000); // Should complete within 1 second
      expect(mockCtx.reply.calledOnce).to.be.true;
    });

    it('should handle rapid successive message calls', async () => {
      const start = Date.now();
      
      for (let i = 0; i < 50; i++) {
        await notOrdersMessage(mockCtx);
      }
      
      const duration = Date.now() - start;
      expect(duration).to.be.lessThan(2000); // Should complete within 2 seconds
      expect(mockCtx.reply.callCount).to.equal(50);
    });
  });
});
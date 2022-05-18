const express = require('express');
const Order = require('../models/order');
const Community = require('../models/community');

const router = express.Router();

router.get('/getCommunities', async (req, res) => {
  try {
    const data = await Community.find({ public: true });
    const {
      _id,
      name,
      group,
      created_at,
      order_channels,
    } = data;

    res.status(200).json({
      success: true,
      data: {
        _id,
        name,
        group,
        created_at,
        order_channels,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/getOrders', async (req, res) => {
  try {
    const data = await Order.find({ status: 'PENDING' });
    const {
      _id,
      description,
      amount,
      fiat_amount,
      fiat_code,
      payment_method,
      price_margin,
    } = data;

    res.status(200).json({
      success: true,
      data: {
        _id,
        name,
        group,
        created_at,
        order_channels,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

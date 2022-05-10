const express = require('express');
const Order = require('../models/order');
const Community = require('../models/community');
const router = express.Router();

router.get('/getCommunities', async (req, res) => {
    try {
         const data = await Community.find();
         res.json(data)
    }
    catch (error) { 
         res.status(500).json({ message: error.message })
    }
})

router.get('/getOrders', async (req, res) => {
    try {
        const data = await Order.find();
        res.json(data)
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
})

module.exports = router;

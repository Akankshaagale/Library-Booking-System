// src/routes/api.js
"use strict";

const express = require("express");
const {
  bookItem,
  listBooks,
  listBookings,
  resetDemo,
} = require("../controllers/bookingController");

const router = express.Router();

router.get("/books",    listBooks);
router.get("/bookings", listBookings);
router.post("/book",    bookItem);
router.delete("/reset", resetDemo);

module.exports = router;

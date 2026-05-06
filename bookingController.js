// src/controllers/bookingController.js
// ─────────────────────────────────────────────────────────────
// Race-condition-safe booking via InnoDB row-level locking.
//
// Strategy:
//   1. BEGIN transaction
//   2. SELECT ... FOR UPDATE  ← acquires an exclusive row lock;
//      any concurrent transaction attempting the same lock will
//      BLOCK here until we COMMIT / ROLLBACK.
//   3. Check quantity (now guaranteed to be the authoritative value)
//   4. Decrement quantity + insert booking record atomically
//   5. COMMIT  (lock is released)
//
// This eliminates the classic TOCTOU race condition where two
// concurrent reads both see quantity=1 and both proceed to book.
// ─────────────────────────────────────────────────────────────
"use strict";

const pool = require("../db");

/**
 * POST /api/book
 * Body: { bookId: number, userId: string }
 */
async function bookItem(req, res) {
  const { bookId, userId } = req.body;

  // ── Input validation ──────────────────────────────────────
  if (!bookId || !userId) {
    return res.status(400).json({
      success: false,
      message: "bookId and userId are required.",
    });
  }

  const id = parseInt(bookId, 10);
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "bookId must be a positive integer.",
    });
  }

  // ── Acquire a connection from the pool ───────────────────
  const conn = await pool.getConnection();

  try {
    // ── 1. START TRANSACTION ─────────────────────────────
    await conn.beginTransaction();

    // ── 2. Exclusive row-lock on this specific book row ──
    //    SELECT … FOR UPDATE prevents any other transaction
    //    from reading (with FOR UPDATE / FOR SHARE) or
    //    writing to this row until we release the lock.
    const [rows] = await conn.execute(
      "SELECT id, title, quantity FROM books WHERE id = ? FOR UPDATE",
      [id]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: `Book with id ${id} not found.`,
      });
    }

    const book = rows[0];

    // ── 3. Check availability ────────────────────────────
    if (book.quantity <= 0) {
      await conn.rollback();
      // 409 Conflict: resource state prevents fulfilling the request
      return res.status(409).json({
        success: false,
        message: `"${book.title}" is out of stock.`,
        book: { id: book.id, title: book.title, quantity: 0 },
      });
    }

    // ── 4a. Decrement quantity ───────────────────────────
    await conn.execute(
      "UPDATE books SET quantity = quantity - 1 WHERE id = ?",
      [id]
    );

    // ── 4b. Record the booking ───────────────────────────
    const [result] = await conn.execute(
      "INSERT INTO bookings (book_id, user_id) VALUES (?, ?)",
      [id, String(userId)]
    );

    // ── 5. COMMIT (releases the row lock) ────────────────
    await conn.commit();

    return res.status(201).json({
      success: true,
      message: `Successfully booked "${book.title}".`,
      booking: {
        id:       result.insertId,
        bookId:   book.id,
        title:    book.title,
        userId:   userId,
        bookedAt: new Date().toISOString(),
      },
      remainingQuantity: book.quantity - 1,
    });

  } catch (err) {
    // Roll back so any partial writes are discarded
    await conn.rollback();
    console.error("[bookItem] Transaction error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again.",
    });
  } finally {
    // Always release the connection back to the pool
    conn.release();
  }
}

/**
 * GET /api/books
 * Returns all books with current quantities.
 */
async function listBooks(req, res) {
  try {
    const [books] = await pool.execute(
      "SELECT id, title, author, quantity, created_at FROM books ORDER BY id"
    );
    return res.status(200).json({ success: true, books });
  } catch (err) {
    console.error("[listBooks] Error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

/**
 * GET /api/bookings
 * Returns all booking records (for inspection / debugging).
 */
async function listBookings(req, res) {
  try {
    const [bookings] = await pool.execute(`
      SELECT bk.id, bk.user_id, bk.booked_at,
             b.id AS book_id, b.title
      FROM   bookings bk
      JOIN   books    b  ON bk.book_id = b.id
      ORDER  BY bk.id
    `);
    return res.status(200).json({ success: true, bookings });
  } catch (err) {
    console.error("[listBookings] Error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

/**
 * DELETE /api/reset
 * Resets the demo data (for repeated stress testing).
 */
async function resetDemo(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("DELETE FROM bookings");
    await conn.execute("UPDATE books SET quantity = 1 WHERE id = 1");
    await conn.execute("UPDATE books SET quantity = 2 WHERE id = 2");
    await conn.execute("UPDATE books SET quantity = 1 WHERE id = 3");
    await conn.commit();
    return res.status(200).json({ success: true, message: "Demo data reset." });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
}

module.exports = { bookItem, listBooks, listBookings, resetDemo };

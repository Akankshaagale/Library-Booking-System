# 📚 Library Booking System — High-Concurrency Backend

A production-grade backend API that prevents **race conditions** in a high-concurrency booking environment using **database-level row locking**.

---

## 🏗️ Project Structure

```
library-booking-system/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   └── bookingController.js   # Core booking logic with locking
│   │   ├── routes/
│   │   │   └── api.js                 # Express route definitions
│   │   ├── db.js                      # MySQL connection pool
│   │   └── server.js                  # Entry point
│   ├── .env.example                   # Environment variable template
│   └── package.json
├── frontend/
│   └── index.html                     # Stress-test UI (served by Express)
├── sql/
│   └── schema.sql                     # DB schema + seed data
└── README.md
```

---

## ⚙️ Prerequisites

| Tool        | Version    |
|-------------|------------|
| Node.js     | ≥ 18.x     |
| MySQL       | ≥ 8.0 (InnoDB) |
| npm         | ≥ 9.x      |

---

## 🚀 Setup Instructions

### 1. Initialize the Database

```bash
# Log in to MySQL
mysql -u root -p

# Run the schema file
mysql -u root -p < sql/schema.sql
```

This creates the `library_booking` database, the `books` and `bookings` tables, and seeds three sample books (book #1 with `quantity = 1`).

### 2. Configure Environment Variables

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=library_booking
PORT=3000
```

### 3. Install Dependencies & Start

```bash
cd backend
npm install
npm start
```

The server starts at **http://localhost:3000**.

---

## 🌐 API Endpoints

| Method   | Endpoint        | Description                          |
|----------|-----------------|--------------------------------------|
| `GET`    | `/api/books`    | List all books with current quantity |
| `POST`   | `/api/book`     | Book an item (concurrency-safe)      |
| `GET`    | `/api/bookings` | List all booking records             |
| `DELETE` | `/api/reset`    | Reset demo data (for re-testing)     |

### POST `/api/book`

**Request body:**
```json
{ "bookId": 1, "userId": "user_42" }
```

**Success (201):**
```json
{
  "success": true,
  "message": "Successfully booked \"The Pragmatic Programmer\".",
  "booking": {
    "id": 1,
    "bookId": 1,
    "title": "The Pragmatic Programmer",
    "userId": "user_42",
    "bookedAt": "2025-01-15T10:23:45.000Z"
  },
  "remainingQuantity": 0
}
```

**Out of stock (409):**
```json
{
  "success": false,
  "message": "\"The Pragmatic Programmer\" is out of stock."
}
```

---

## 🔒 How Race Conditions Are Prevented

### The Problem: Check-Then-Act Race

In a naive implementation:
```
User A reads:  quantity = 1  ✓ available
User B reads:  quantity = 1  ✓ available  ← same value, both win!
User A writes: quantity = 0
User B writes: quantity = -1  ← OVER-BOOKED!
```

### The Solution: `SELECT … FOR UPDATE` (Row-Level Locking)

The booking endpoint uses **InnoDB's row-level exclusive lock**:

```sql
-- STEP 1: Acquire exclusive lock on this row
SELECT id, title, quantity FROM books WHERE id = ? FOR UPDATE;

-- STEP 2: Check quantity (now guaranteed authoritative)
-- STEP 3: Atomically decrement + record booking
UPDATE books SET quantity = quantity - 1 WHERE id = ?;
INSERT INTO bookings (book_id, user_id) VALUES (?, ?);

-- STEP 4: Commit (releases the lock)
COMMIT;
```

**What `FOR UPDATE` guarantees:**
- Any other transaction that tries `SELECT … FOR UPDATE` on the **same row** will **BLOCK** (wait) until the first transaction commits or rolls back.
- Only one transaction can hold the lock at a time — serializing access to that row.
- If the `UPDATE` or `INSERT` fails for any reason, `ROLLBACK` ensures neither change persists (**Atomicity**).

### Additional Safeguards

- **`TINYINT UNSIGNED`** on the `quantity` column: MySQL physically cannot store negative values; it would throw an error even if the locking was bypassed.
- **`CHECK (quantity >= 0)`** constraint (MySQL 8.0.16+): enforced at the database level.
- **Connection pooling** with `mysql2/promise`: each concurrent HTTP request gets its own connection + transaction, avoiding accidental state sharing.

---

## 🧪 Running the Stress Test

### Via the UI (recommended)

1. Open **http://localhost:3000** in your browser.
2. Select a book (e.g., *The Pragmatic Programmer*, qty = 1).
3. Set **Concurrent Requests** to `10`.
4. Click **⚡ Fire Stress Test**.

The UI fires all 10 requests simultaneously using `Promise.all`. You should see:

- ✅ **1 success** (HTTP 201)
- ❌ **9 rejections** (HTTP 409 — out of stock)

### Via `curl` / script

```bash
# Fire 10 simultaneous requests with bash:
for i in $(seq 1 10); do
  curl -s -X POST http://localhost:3000/api/book \
       -H "Content-Type: application/json" \
       -d "{\"bookId\":1,\"userId\":\"user_$i\"}" &
done
wait
```

Expected console output: exactly 1 `201 Created`, 9 `409 Conflict`.

---

## 📸 Expected Stress Test Result

```
Request  Status  Message
──────────────────────────────────────────────────────
#01      201     Successfully booked "The Pragmatic Programmer"
#02      409     "The Pragmatic Programmer" is out of stock
#03      409     "The Pragmatic Programmer" is out of stock
#04      409     "The Pragmatic Programmer" is out of stock
...
#10      409     "The Pragmatic Programmer" is out of stock

✅ PASS — 1 success, 9 rejected. Race condition prevented.
```

---

## ✅ Evaluation Criteria Checklist

| Criterion | Implementation |
|-----------|---------------|
| **Atomicity** | `BEGIN` / `COMMIT` / `ROLLBACK` — either both the UPDATE and INSERT succeed or neither does |
| **Concurrency Handling** | `SELECT … FOR UPDATE` serializes access; exactly 1 success per qty=1 book |
| **HTTP Status Codes** | `201 Created`, `409 Conflict` (out of stock), `400 Bad Request`, `404 Not Found`, `500` |
| **DB-Level Locking** | InnoDB row lock via `FOR UPDATE` — no app-level global variables or in-memory locks |
| **No Negative Stock** | `TINYINT UNSIGNED` + `CHECK (quantity >= 0)` |

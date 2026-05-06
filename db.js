// src/db.js – MySQL connection pool using mysql2/promise
"use strict";

const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || "localhost",
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || "root",
  password:           process.env.DB_PASSWORD || "",
  database:           process.env.DB_NAME     || "library_booking",
  waitForConnections: true,
  connectionLimit:    20,       // tune to your MySQL max_connections
  queueLimit:         0,
  timezone:           "+00:00",
});

module.exports = pool;

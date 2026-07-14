const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "bsccars",
  connectionLimit: 10,
  connectTimeout: process.env.DB_CONNECT_TIMEOUT
    ? Number(process.env.DB_CONNECT_TIMEOUT)
    : 1000,
});

module.exports = pool;

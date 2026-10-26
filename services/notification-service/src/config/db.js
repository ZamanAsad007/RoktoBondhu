const { Pool } = require('pg');
const config = require('./index');

const pool = new Pool(config.db);

pool.on('error', (err) => {
  console.error('[Notification DB] Unexpected pool error:', err.message);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};

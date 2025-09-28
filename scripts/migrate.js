// scripts/migrate.js
import fs from 'fs';
import path from 'path';
import pool from '../src/db.js';

const sql = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql')).toString();

(async () => {
  try {
    await pool.query(sql);
    console.log('Migrations ran successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();

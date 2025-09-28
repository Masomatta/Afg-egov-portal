import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required on Render
});

export default pool;

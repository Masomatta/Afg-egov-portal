
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config(); 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});


pool.connect()
  .then(client => {
    console.log("✅ Connected to PostgreSQL on Render");
    client.release();
  })
  .catch(err => console.error("❌ Database connection error:", err.stack));

export default pool;

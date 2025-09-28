//import app from "./app.js";
//import dotenv from "dotenv";
//dotenv.config("/.env");

//const testDb = async () => {
//    console.log("Database is connected.");
//};
//testDb();
//app.listen(process.env.PORT, () => {
//  console.log(`The server is on, listening on port ${process.env.PORT}!`);
//});

// src/index.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import requestsRoutes from './routes/requests.js';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(helmet());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Rate limiter
const limiter = rateLimit({ windowMs: 60 * 1000, max: 200 });
app.use(limiter);

// Routes
app.use('/auth', authRoutes);
app.use('/requests', requestsRoutes);

// Home
app.get('/', (req, res) => {
  res.render('layout', { title: 'E-Government Portal', content: '<h2>Welcome to E-Gov Portal</h2>' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Server Error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import citizenRoutes from './routes/citizen.js';
import officerRoutes from './routes/officer.js';
import adminRoutes from './routes/admin.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;


app.set('trust proxy', 1);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', 
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 
  }
}));


app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', authRoutes);
app.use('/citizen', citizenRoutes);
app.use('/officer', officerRoutes);
app.use('/admin', adminRoutes);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));


app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
});


app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found' });
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: 'Something went wrong!' });
});


app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;

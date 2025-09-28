import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';

const router = express.Router();

// Login page
router.get('/login', (req, res) => {
  // If user is already logged in, redirect to appropriate dashboard
  if (req.session.user) {
    switch (req.session.user.user_type) {
      case 'citizen':
        return res.redirect('/citizen/dashboard');
      case 'officer':
      case 'department_head':
        return res.redirect('/officer/dashboard');
      case 'admin':
        return res.redirect('/admin/dashboard');
      default:
        return res.redirect('/');
    }
  }
  
  res.render('auth/login', { 
    error: req.query.error || null,
    message: req.query.message || null
  });
});

// Login processing
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.redirect('/login?error=Invalid credentials');
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.redirect('/login?error=Invalid credentials');
    }
    
    req.session.user = user;
    switch (user.user_type) {
      case 'citizen':
        res.redirect('/citizen/dashboard');
        break;
      case 'officer':
      case 'department_head':
        res.redirect('/officer/dashboard');
        break;
      case 'admin':
        res.redirect('/admin/dashboard');
        break;
      default:
        res.redirect('/');
    }
  } catch (error) {
    console.error(error);
    res.redirect('/login?error=Server error');
  }
});

// Register page
router.get('/register', (req, res) => {
  // If user is already logged in, redirect to appropriate dashboard
  if (req.session.user) {
    switch (req.session.user.user_type) {
      case 'citizen':
        return res.redirect('/citizen/dashboard');
      case 'officer':
      case 'department_head':
        return res.redirect('/officer/dashboard');
      case 'admin':
        return res.redirect('/admin/dashboard');
      default:
        return res.redirect('/');
    }
  }
  
  res.render('auth/register', { 
    error: req.query.error || null,
    message: req.query.message || null
  });
});

// Register processing
router.post('/register', async (req, res) => {
  const { national_id, name, email, password, confirm_password, date_of_birth, contact_info } = req.body;
  
  if (password !== confirm_password) {
    return res.redirect('/register?error=Passwords do not match');
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.query(
      `INSERT INTO users (national_id, name, email, password, date_of_birth, contact_info, user_type) 
       VALUES ($1, $2, $3, $4, $5, $6, 'citizen')`,
      [national_id, name, email, hashedPassword, date_of_birth, contact_info]
    );
    
    res.redirect('/login?message=Registration successful. Please login.');
  } catch (error) {
    console.error(error);
    if (error.code === '23505') {
      res.redirect('/register?error=Email or National ID already exists');
    } else {
      res.redirect('/register?error=Server error');
    }
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/');
    }
    res.redirect('/');
  });
});

export default router;
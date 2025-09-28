import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import pool from '../config/database.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Middleware to check if user is a citizen
router.use(requireAuth);
router.use(requireRole(['citizen']));

// Citizen dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const requests = await pool.query(
      `SELECT r.*, s.name as service_name, d.name as department_name 
       FROM requests r 
       JOIN services s ON r.service_id = s.id 
       JOIN departments d ON s.department_id = d.id 
       WHERE r.citizen_id = $1 
       ORDER BY r.submitted_at DESC`,
      [req.session.user.id]
    );
    
    res.render('citizen/dashboard', { 
      requests: requests.rows 
    });
  } catch (error) {
    console.error(error);
    res.render('error', { message: 'Server error' });
  }
});

// Apply for a service - show form
router.get('/apply', async (req, res) => {
  try {
    const services = await pool.query(
      `SELECT s.*, d.name as department_name 
       FROM services s 
       JOIN departments d ON s.department_id = d.id
       ORDER BY d.name, s.name`
    );
    
    res.render('citizen/apply', { 
      services: services.rows,
      message: req.query.message || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error(error);
    res.render('error', { message: 'Server error' });
  }
});

// Submit service application
router.post('/apply', upload.array('documents', 5), async (req, res) => {
  const { service_id, notes } = req.body;
  
  try {
    // Get service details to check if payment is required
    const serviceResult = await pool.query(
      'SELECT * FROM services WHERE id = $1',
      [service_id]
    );
    
    if (serviceResult.rows.length === 0) {
      return res.redirect('/citizen/apply?error=Service not found');
    }
    
    const service = serviceResult.rows[0];
    
    // Create request
    const requestResult = await pool.query(
      `INSERT INTO requests (citizen_id, service_id, notes) 
       VALUES ($1, $2, $3) RETURNING id`,
      [req.session.user.id, service_id, notes]
    );
    
    const requestId = requestResult.rows[0].id;
    
    // Handle document uploads
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await pool.query(
          `INSERT INTO documents (request_id, filename, filepath) 
           VALUES ($1, $2, $3)`,
          [requestId, file.originalname, file.filename]
        );
      }
    }
    
    // Create payment record if service has a fee
    if (service.fee > 0) {
      await pool.query(
        `INSERT INTO payments (request_id, amount, status) 
         VALUES ($1, $2, 'pending')`,
        [requestId, service.fee]
      );
    }
    
    // Create notification for the citizen
    await pool.query(
      `INSERT INTO notifications (user_id, message) 
       VALUES ($1, $2)`,
      [req.session.user.id, `Your ${service.name} request has been submitted successfully.`]
    );
    
    res.redirect('/citizen/dashboard?message=Application submitted successfully');
  } catch (error) {
    console.error(error);
    res.redirect('/citizen/apply?error=Server error');
  }
});

// View application details
router.get('/request/:id', async (req, res) => {
  try {
    const requestId = req.params.id;
    
    const requestResult = await pool.query(
      `SELECT r.*, s.name as service_name, s.fee, d.name as department_name 
       FROM requests r 
       JOIN services s ON r.service_id = s.id 
       JOIN departments d ON s.department_id = d.id 
       WHERE r.id = $1 AND r.citizen_id = $2`,
      [requestId, req.session.user.id]
    );
    
    if (requestResult.rows.length === 0) {
      return res.render('error', { message: 'Request not found' });
    }
    
    const request = requestResult.rows[0];
    
    const documents = await pool.query(
      'SELECT * FROM documents WHERE request_id = $1',
      [requestId]
    );
    
    const payment = await pool.query(
      'SELECT * FROM payments WHERE request_id = $1',
      [requestId]
    );
    
    res.render('citizen/request-details', {
      request,
      documents: documents.rows,
      payment: payment.rows[0] || null
    });
  } catch (error) {
    console.error(error);
    res.render('error', { message: 'Server error' });
  }
});

// Simulate payment
router.post('/payment/:requestId', async (req, res) => {
  try {
    const requestId = req.params.requestId;
    
    // Verify the request belongs to the user
    const requestResult = await pool.query(
      'SELECT * FROM requests WHERE id = $1 AND citizen_id = $2',
      [requestId, req.session.user.id]
    );
    
    if (requestResult.rows.length === 0) {
      return res.render('error', { message: 'Request not found' });
    }
    
    // Update payment status
    await pool.query(
      `UPDATE payments SET status = 'completed', payment_date = CURRENT_TIMESTAMP 
       WHERE request_id = $1`,
      [requestId]
    );
    
    res.redirect(`/citizen/request/${requestId}?message=Payment completed successfully`);
  } catch (error) {
    console.error(error);
    res.render('error', { message: 'Server error' });
  }
});

export default router;
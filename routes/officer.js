import express from 'express';
import { requireOfficer } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// All officer routes require officer role (or admin)
router.use(requireOfficer);

// Officer Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const user = req.session.user;
    
    let query = `
      SELECT r.*, u.name as citizen_name, u.national_id, s.name as service_name, 
             d.name as department_name, s.department_id
      FROM requests r
      JOIN users u ON r.citizen_id = u.id
      JOIN services s ON r.service_id = s.id
      JOIN departments d ON s.department_id = d.id
      WHERE r.status IN ('submitted', 'under_review')
    `;
    
    const queryParams = [];
    
    // Department heads see all requests in their department
    // Regular officers see unassigned requests or requests assigned to them
    if (user.user_type === 'department_head') {
      query += ' AND s.department_id = $1';
      queryParams.push(user.department_id);
    } else if (user.user_type === 'officer') {
      query += ' AND s.department_id = $1 AND (r.reviewed_by IS NULL OR r.reviewed_by = $2)';
      queryParams.push(user.department_id, user.id);
    }
    // Admins see all requests (no filter)
    
    query += ' ORDER BY r.submitted_at DESC LIMIT 50';
    
    const requests = await pool.query(query, queryParams);
    
    // Get officer statistics
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_assigned,
        COUNT(CASE WHEN status = 'under_review' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
      FROM requests 
      WHERE reviewed_by = $1
    `, [user.id]);

    // Get department name for display
    let departmentName = 'No Department';
    if (user.department_id) {
      const deptResult = await pool.query('SELECT name FROM departments WHERE id = $1', [user.department_id]);
      departmentName = deptResult.rows[0]?.name || 'No Department';
    }
    
    res.render('officer/dashboard', {
      requests: requests.rows,
      stats: stats.rows[0] || { total_assigned: 0, in_progress: 0, approved: 0, rejected: 0 },
      user: user,
      departmentName: departmentName
    });
  } catch (error) {
    console.error('Officer dashboard error:', error);
    res.render('error', { message: 'Server error' });
  }
});

// View Request Details
router.get('/request/:id', async (req, res) => {
  try {
    const requestId = req.params.id;
    const user = req.session.user;
    
    const request = await pool.query(`
      SELECT r.*, u.name as citizen_name, u.national_id, u.contact_info, u.date_of_birth,
             s.name as service_name, s.fee, s.requirements, d.name as department_name,
             officer.name as officer_name, officer.email as officer_email
      FROM requests r
      JOIN users u ON r.citizen_id = u.id
      JOIN services s ON r.service_id = s.id
      JOIN departments d ON s.department_id = d.id
      LEFT JOIN users officer ON r.reviewed_by = officer.id
      WHERE r.id = $1
    `, [requestId]);
    
    if (request.rows.length === 0) {
      return res.render('error', { message: 'Request not found' });
    }
    
    const requestData = request.rows[0];
    
    // Check if officer has access to this request
    if (user.user_type === 'officer' && requestData.department_id !== user.department_id) {
      return res.render('error', { message: 'Access denied' });
    }
    
    // Get documents
    const documents = await pool.query(
      'SELECT * FROM documents WHERE request_id = $1 ORDER BY uploaded_at DESC',
      [requestId]
    );
    
    // Get payment info
    const payment = await pool.query(
      'SELECT * FROM payments WHERE request_id = $1',
      [requestId]
    );
    
    // Get request history
    const history = await pool.query(`
      SELECT 'submitted' as action, submitted_at as date, NULL as officer_name
      FROM requests WHERE id = $1
      UNION ALL
      SELECT 'reviewed' as action, reviewed_at as date, u.name as officer_name
      FROM requests r
      LEFT JOIN users u ON r.reviewed_by = u.id
      WHERE r.id = $1 AND r.reviewed_at IS NOT NULL
      ORDER BY date
    `, [requestId]);
    
    res.render('officer/request-details', {
      request: requestData,
      documents: documents.rows,
      payment: payment.rows[0] || null,
      history: history.rows,
      user: user
    });
  } catch (error) {
    console.error('Officer request details error:', error);
    res.render('error', { message: 'Server error' });
  }
});

// Update Request Status
router.post('/request/:id/status', async (req, res) => {
  try {
    const requestId = req.params.id;
    const { status, officer_notes } = req.body;
    const user = req.session.user;
    
    // Verify request exists and officer has access
    const requestCheck = await pool.query(`
      SELECT s.department_id 
      FROM requests r
      JOIN services s ON r.service_id = s.id
      WHERE r.id = $1
    `, [requestId]);
    
    if (requestCheck.rows.length === 0) {
      return res.redirect('/officer/dashboard?error=Request not found');
    }
    
    if (user.user_type === 'officer' && requestCheck.rows[0].department_id !== user.department_id) {
      return res.redirect('/officer/dashboard?error=Access denied');
    }
    
    // Update request status
    await pool.query(`
      UPDATE requests 
      SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, notes = $3
      WHERE id = $4
    `, [status, user.id, officer_notes, requestId]);
    
    // Get citizen info for notification
    const citizenInfo = await pool.query(`
      SELECT u.id, u.name, u.email, s.name as service_name
      FROM requests r
      JOIN users u ON r.citizen_id = u.id
      JOIN services s ON r.service_id = s.id
      WHERE r.id = $1
    `, [requestId]);
    
    if (citizenInfo.rows.length > 0) {
      const citizen = citizenInfo.rows[0];
      const message = `Your ${citizen.service_name} request has been ${status}.`;
      
      await pool.query(
        'INSERT INTO notifications (user_id, message) VALUES ($1, $2)',
        [citizen.id, message]
      );
    }
    
    res.redirect(`/officer/request/${requestId}?message=Status updated successfully`);
  } catch (error) {
    console.error('Officer status update error:', error);
    res.redirect('/officer/dashboard?error=Error updating status');
  }
});

// Assign Request to Officer
router.post('/request/:id/assign', async (req, res) => {
  try {
    const requestId = req.params.id;
    const { officer_id } = req.body;
    const user = req.session.user;
    
    // Only department heads and admins can assign requests
    if (!['department_head', 'admin'].includes(user.user_type)) {
      return res.redirect('/officer/dashboard?error=Access denied');
    }
    
    await pool.query(`
      UPDATE requests 
      SET reviewed_by = $1, status = 'under_review'
      WHERE id = $2
    `, [officer_id, requestId]);
    
    res.redirect(`/officer/request/${requestId}?message=Request assigned successfully`);
  } catch (error) {
    console.error('Officer assign error:', error);
    res.redirect('/officer/dashboard?error=Error assigning request');
  }
});

// Get Department Officers (for assignment)
router.get('/department/officers', async (req, res) => {
  try {
    const user = req.session.user;
    let departmentId = user.department_id;
    
    // Admins can specify department
    if (user.user_type === 'admin' && req.query.department_id) {
      departmentId = req.query.department_id;
    }
    
    const officers = await pool.query(`
      SELECT id, name, email, job_title, user_type
      FROM users 
      WHERE department_id = $1 AND user_type IN ('officer', 'department_head')
      ORDER BY user_type DESC, name
    `, [departmentId]);
    
    res.json(officers.rows);
  } catch (error) {
    console.error('Officer list error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
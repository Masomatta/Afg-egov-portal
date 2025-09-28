import express from 'express';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// All admin routes require admin role
router.use(requireAdmin);

// Admin Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    // Get statistics for dashboard
    const [
      totalRequests,
      totalUsers,
      requestsByStatus,
      requestsByDepartment,
      recentRequests,
      systemStats
    ] = await Promise.all([
      // Total requests
      pool.query('SELECT COUNT(*) FROM requests'),
      
      // Total users
      pool.query('SELECT COUNT(*) FROM users'),
      
      // Requests by status
      pool.query(`
        SELECT status, COUNT(*) as count 
        FROM requests 
        GROUP BY status
      `),
      
      // Requests by department
      pool.query(`
        SELECT d.name as department_name, COUNT(r.id) as request_count
        FROM departments d 
        LEFT JOIN services s ON d.id = s.department_id 
        LEFT JOIN requests r ON s.id = r.service_id 
        GROUP BY d.id, d.name 
        ORDER BY request_count DESC
      `),
      
      // Recent requests (last 10)
      pool.query(`
        SELECT r.*, u.name as citizen_name, s.name as service_name, d.name as department_name
        FROM requests r
        JOIN users u ON r.citizen_id = u.id
        JOIN services s ON r.service_id = s.id
        JOIN departments d ON s.department_id = d.id
        ORDER BY r.submitted_at DESC
        LIMIT 10
      `),
      
      // System statistics
      pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM requests WHERE DATE(submitted_at) = CURRENT_DATE) as requests_today,
          (SELECT COUNT(*) FROM requests WHERE status = 'submitted') as pending_requests,
          (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed') as total_revenue
      `)
    ]);

    res.render('admin/dashboard', {
      stats: {
        totalRequests: parseInt(totalRequests.rows[0].count),
        totalUsers: parseInt(totalUsers.rows[0].count),
        requestsToday: parseInt(systemStats.rows[0].requests_today),
        pendingRequests: parseInt(systemStats.rows[0].pending_requests),
        totalRevenue: parseFloat(systemStats.rows[0].total_revenue)
      },
      requestsByStatus: requestsByStatus.rows,
      requestsByDepartment: requestsByDepartment.rows,
      recentRequests: recentRequests.rows
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.render('error', { message: 'Server error' });
  }
});

// Manage Users
router.get('/users', async (req, res) => {
  try {
    const users = await pool.query(`
      SELECT u.*, d.name as department_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      ORDER BY u.created_at DESC
    `);
    
    const departments = await pool.query('SELECT * FROM departments ORDER BY name');
    
    res.render('admin/users', {
      users: users.rows,
      departments: departments.rows
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.render('error', { message: 'Server error' });
  }
});

// Create/Update User
router.post('/users', async (req, res) => {
  try {
    const { id, national_id, name, email, password, user_type, department_id, job_title } = req.body;
    
    if (id) {
      // Update existing user
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
          `UPDATE users SET national_id = $1, name = $2, email = $3, password = $4, 
           user_type = $5, department_id = $6, job_title = $7 WHERE id = $8`,
          [national_id, name, email, hashedPassword, user_type, department_id, job_title, id]
        );
      } else {
        await pool.query(
          `UPDATE users SET national_id = $1, name = $2, email = $3, 
           user_type = $4, department_id = $5, job_title = $6 WHERE id = $7`,
          [national_id, name, email, user_type, department_id, job_title, id]
        );
      }
      res.redirect('/admin/users?message=User updated successfully');
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        `INSERT INTO users (national_id, name, email, password, user_type, department_id, job_title) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [national_id, name, email, hashedPassword, user_type, department_id, job_title]
      );
      res.redirect('/admin/users?message=User created successfully');
    }
  } catch (error) {
    console.error('Admin user update error:', error);
    res.redirect('/admin/users?error=Error saving user');
  }
});

// Delete User
router.post('/users/delete/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.session.user.id) {
      return res.redirect('/admin/users?error=Cannot delete your own account');
    }
    
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.redirect('/admin/users?message=User deleted successfully');
  } catch (error) {
    console.error('Admin user delete error:', error);
    res.redirect('/admin/users?error=Error deleting user');
  }
});

// Manage Departments
router.get('/departments', async (req, res) => {
  try {
    const departments = await pool.query(`
      SELECT d.*, COUNT(s.id) as service_count, COUNT(u.id) as user_count
      FROM departments d
      LEFT JOIN services s ON d.id = s.department_id
      LEFT JOIN users u ON d.id = u.department_id AND u.user_type IN ('officer', 'department_head')
      GROUP BY d.id
      ORDER BY d.name
    `);
    
    res.render('admin/departments', {
      departments: departments.rows
    });
  } catch (error) {
    console.error('Admin departments error:', error);
    res.render('error', { message: 'Server error' });
  }
});

// Create/Update Department
router.post('/departments', async (req, res) => {
  try {
    const { id, name, description } = req.body;
    
    if (id) {
      await pool.query(
        'UPDATE departments SET name = $1, description = $2 WHERE id = $3',
        [name, description, id]
      );
      res.redirect('/admin/departments?message=Department updated successfully');
    } else {
      await pool.query(
        'INSERT INTO departments (name, description) VALUES ($1, $2)',
        [name, description]
      );
      res.redirect('/admin/departments?message=Department created successfully');
    }
  } catch (error) {
    console.error('Admin department update error:', error);
    res.redirect('/admin/departments?error=Error saving department');
  }
});

// Manage Services
router.get('/services', async (req, res) => {
  try {
    const services = await pool.query(`
      SELECT s.*, d.name as department_name, COUNT(r.id) as request_count
      FROM services s 
      JOIN departments d ON s.department_id = d.id 
      LEFT JOIN requests r ON s.id = r.service_id
      GROUP BY s.id, d.name
      ORDER BY d.name, s.name
    `);
    
    const departments = await pool.query('SELECT * FROM departments ORDER BY name');
    
    res.render('admin/services', {
      services: services.rows,
      departments: departments.rows
    });
  } catch (error) {
    console.error('Admin services error:', error);
    res.render('error', { message: 'Server error' });
  }
});

// Create/Update Service
router.post('/services', async (req, res) => {
  try {
    const { id, name, description, department_id, fee, requirements } = req.body;
    
    if (id) {
      await pool.query(
        `UPDATE services SET name = $1, description = $2, department_id = $3, fee = $4, requirements = $5 
         WHERE id = $6`,
        [name, description, department_id, parseFloat(fee) || 0, requirements, id]
      );
      res.redirect('/admin/services?message=Service updated successfully');
    } else {
      await pool.query(
        `INSERT INTO services (name, description, department_id, fee, requirements) 
         VALUES ($1, $2, $3, $4, $5)`,
        [name, description, department_id, parseFloat(fee) || 0, requirements]
      );
      res.redirect('/admin/services?message=Service created successfully');
    }
  } catch (error) {
    console.error('Admin service update error:', error);
    res.redirect('/admin/services?error=Error saving service');
  }
});

// View All Requests
router.get('/requests', async (req, res) => {
  try {
    const { status, department, search } = req.query;
    
    let query = `
      SELECT r.*, u.name as citizen_name, u.national_id, s.name as service_name, 
             d.name as department_name, officer.name as officer_name
      FROM requests r
      JOIN users u ON r.citizen_id = u.id
      JOIN services s ON r.service_id = s.id
      JOIN departments d ON s.department_id = d.id
      LEFT JOIN users officer ON r.reviewed_by = officer.id
    `;
    
    const queryParams = [];
    const conditions = [];
    
    if (status && status !== 'all') {
      conditions.push(`r.status = $${queryParams.length + 1}`);
      queryParams.push(status);
    }
    
    if (department && department !== 'all') {
      conditions.push(`d.id = $${queryParams.length + 1}`);
      queryParams.push(parseInt(department));
    }
    
    if (search) {
      conditions.push(`(u.name ILIKE $${queryParams.length + 1} OR u.national_id ILIKE $${queryParams.length + 1} OR s.name ILIKE $${queryParams.length + 1})`);
      queryParams.push(`%${search}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY r.submitted_at DESC';
    
    const requests = await pool.query(query, queryParams);
    const departments = await pool.query('SELECT * FROM departments ORDER BY name');
    
    res.render('admin/requests', {
      requests: requests.rows,
      departments: departments.rows,
      filters: { status, department, search }
    });
  } catch (error) {
    console.error('Admin requests error:', error);
    res.render('error', { message: 'Server error' });
  }
});

// System Reports
router.get('/reports', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Date range calculation based on period
    let dateRange = '';
    switch (period) {
      case 'week':
        dateRange = `AND r.submitted_at >= CURRENT_DATE - INTERVAL '7 days'`;
        break;
      case 'month':
        dateRange = `AND r.submitted_at >= CURRENT_DATE - INTERVAL '30 days'`;
        break;
      case 'year':
        dateRange = `AND r.submitted_at >= CURRENT_DATE - INTERVAL '365 days'`;
        break;
      default:
        dateRange = '';
    }
    
    const [
      requestsOverTime,
      departmentPerformance,
      servicePopularity,
      revenueReport
    ] = await Promise.all([
      // Requests over time
      pool.query(`
        SELECT DATE(r.submitted_at) as date, COUNT(*) as count, r.status
        FROM requests r
        WHERE 1=1 ${dateRange}
        GROUP BY DATE(r.submitted_at), r.status
        ORDER BY date DESC
        LIMIT 30
      `),
      
      // Department performance
      pool.query(`
        SELECT d.name, 
               COUNT(r.id) as total_requests,
               COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved,
               COUNT(CASE WHEN r.status = 'rejected' THEN 1 END) as rejected,
               AVG(CASE WHEN r.reviewed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (r.reviewed_at - r.submitted_at))/86400 END) as avg_processing_days
        FROM departments d
        LEFT JOIN services s ON d.id = s.department_id
        LEFT JOIN requests r ON s.id = r.service_id
        WHERE 1=1 ${dateRange}
        GROUP BY d.id, d.name
        ORDER BY total_requests DESC
      `),
      
      // Service popularity
      pool.query(`
        SELECT s.name, d.name as department_name, COUNT(r.id) as request_count
        FROM services s
        JOIN departments d ON s.department_id = d.id
        LEFT JOIN requests r ON s.id = r.service_id
        WHERE 1=1 ${dateRange}
        GROUP BY s.id, s.name, d.name
        ORDER BY request_count DESC
        LIMIT 10
      `),
      
      // Revenue report
      pool.query(`
        SELECT DATE(p.payment_date) as date, s.name as service_name, 
               COUNT(p.id) as payment_count, SUM(p.amount) as total_amount
        FROM payments p
        JOIN requests r ON p.request_id = r.id
        JOIN services s ON r.service_id = s.id
        WHERE p.status = 'completed' ${dateRange.replace('r.submitted_at', 'p.payment_date')}
        GROUP BY DATE(p.payment_date), s.name
        ORDER BY date DESC
        LIMIT 30
      `)
    ]);
    
    res.render('admin/reports', {
      period,
      requestsOverTime: requestsOverTime.rows,
      departmentPerformance: departmentPerformance.rows,
      servicePopularity: servicePopularity.rows,
      revenueReport: revenueReport.rows
    });
  } catch (error) {
    console.error('Admin reports error:', error);
    res.render('error', { message: 'Server error' });
  }
});

export default router;
// src/routes/requests.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool from '../config/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadToStorage } from '../utils/storage.js'; // abstracts local/S3

const router = express.Router();

// Multer local storage for dev
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const updir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(updir)) fs.mkdirSync(updir);
      cb(null, updir);
    },
    filename: (req, file, cb) => {
      const name = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
      cb(null, name);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Render apply form
router.get('/apply/:serviceId', requireAuth(true), async (req, res) => {
  const { serviceId } = req.params;
  const serviceQ = await pool.query('SELECT * FROM services WHERE id=$1', [serviceId]);
  if (!serviceQ.rowCount) return res.status(404).send('Service not found');
  res.render('requests/apply', { service: serviceQ.rows[0], error: null });
});

// Submit request + files + (simulate payment)
router.post('/apply/:serviceId', requireAuth(true), upload.array('documents', 6), async (req, res) => {
  const { serviceId } = req.params;
  const { body, files } = req;
  try {
    // Insert request
    const insertReq = await pool.query(
      `INSERT INTO requests (user_id, service_id, data, status) VALUES ($1,$2,$3,'submitted') RETURNING id`,
      [req.user.id, serviceId, JSON.stringify(body)]
    );
    const requestId = insertReq.rows[0].id;

    // Save documents (upload to S3 or leave local)
    for (const f of files) {
      let url = `/uploads/${f.filename}`;
      // If in production and S3 configured, upload and get S3 URL
      if (process.env.AWS_S3_BUCKET) {
        url = await uploadToStorage(f.path, f.filename);
        // Remove local file after upload
        try { fs.unlinkSync(f.path); } catch(e){/*ignore*/ }
      }
      await pool.query('INSERT INTO documents (request_id, filename, url) VALUES ($1,$2,$3)', [requestId, f.originalname, url]);
    }

    // Check service fee
    const sQ = await pool.query('SELECT fee FROM services WHERE id=$1', [serviceId]);
    const fee = sQ.rows[0]?.fee || 0;

    if (fee > 0) {
      // Simulate a payment: create payment row and mark paid
      const payQ = await pool.query(
        `INSERT INTO payments (request_id, amount, provider, provider_ref, status, paid_at) VALUES ($1,$2,'SIM','SIM123','paid',NOW()) RETURNING id`,
        [requestId, fee]
      );
    }

    // Create notification
    await pool.query('INSERT INTO notifications (user_id, message) VALUES ($1,$2)', [req.user.id, `Your request #${requestId} has been submitted.`]);

    res.render('layout', { title: 'Submitted', content: `<h3>Request submitted (ID ${requestId}). Check your dashboard.</h3>` });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error submitting request');
  }
});

// Officer: list requests (with search & filter)
router.get('/', requireAuth(true), async (req, res) => {
  // citizens see their requests, officers see their department, admins see all
  const qParams = [];
  let baseQ = `SELECT r.*, s.name as service_name, u.name as citizen_name FROM requests r
    LEFT JOIN services s ON s.id=r.service_id
    LEFT JOIN users u ON u.id=r.user_id`;
  const { status, q, from, to } = req.query;

  // Basic filtering for citizen
  if (req.user.role === 'citizen') {
    baseQ += ` WHERE r.user_id = $1`;
    qParams.push(req.user.id);
  } else if (req.user.role === 'officer') {
    // show requests belonging to officer's department
    const deptQ = await pool.query('SELECT department_id FROM users WHERE id=$1', [req.user.id]);
    const dept = deptQ.rows[0]?.department_id;
    if (!dept) return res.status(403).send('No department assigned');
    baseQ += qParams.length ? ' AND' : ' WHERE';
    baseQ += ` s.department_id = $${qParams.length + 1}`;
    qParams.push(dept);
  } // admin sees all

  if (status) {
    baseQ += qParams.length ? ' AND' : ' WHERE';
    baseQ += ` r.status = $${qParams.length + 1}`;
    qParams.push(status);
  }

  // Search by citizen name or request id
  if (q) {
    baseQ += ` AND (u.name ILIKE $${qParams.length + 1} OR r.id::text ILIKE $${qParams.length + 1})`;
    qParams.push(`%${q}%`);
  }

  if (from) {
    baseQ += ` AND r.created_at >= $${qParams.length + 1}`; qParams.push(from);
  }
  if (to) {
    baseQ += ` AND r.created_at <= $${qParams.length + 1}`; qParams.push(to);
  }

  baseQ += ' ORDER BY r.created_at DESC LIMIT 200';

  const list = await pool.query(baseQ, qParams);
  res.render('layout', { title: 'Requests', content: `<pre>${JSON.stringify(list.rows, null, 2)}</pre>` });
});

// Officer approves
router.post('/:id/approve', requireAuth(true), requireRole(['officer', 'department_head']), async (req, res) => {
  const { id } = req.params;
  await pool.query('UPDATE requests SET status=$1, updated_at=NOW() WHERE id=$2', ['approved', id]);
  const r = await pool.query('SELECT user_id FROM requests WHERE id=$1', [id]);
  await pool.query('INSERT INTO notifications (user_id,message) VALUES ($1,$2)', [r.rows[0].user_id, `Your request #${id} has been approved.`]);
  res.redirect('/requests');
});

// Officer rejects
router.post('/:id/reject', requireAuth(true), requireRole(['officer','department_head']), async (req, res) => {
  const { id } = req.params;
  const reason = req.body?.reason || 'No reason provided';
  await pool.query('UPDATE requests SET status=$1, updated_at=NOW() WHERE id=$2', ['rejected', id]);
  const r = await pool.query('SELECT user_id FROM requests WHERE id=$1', [id]);
  await pool.query('INSERT INTO notifications (user_id,message) VALUES ($1,$2)', [r.rows[0].user_id, `Your request #${id} has been rejected. Reason: ${reason}`]);
  res.redirect('/requests');
});

export default router;

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    
    if (!roles.includes(req.session.user.user_type)) {
      return res.status(403).render('error', { 
        message: 'Access denied. You do not have permission to view this page.' 
      });
    }
    next();
  };
};

// Specific role checkers
const requireAdmin = requireRole(['admin']);
const requireOfficer = requireRole(['officer', 'department_head', 'admin']); // Admins can access officer pages
const requireCitizen = requireRole(['citizen']);

export { 
  requireAuth, 
  requireRole, 
  requireAdmin, 
  requireOfficer, 
  requireCitizen 
};
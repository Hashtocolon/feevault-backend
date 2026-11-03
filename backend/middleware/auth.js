const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'feevault_super_secret_jwt_key_2026';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'feevault_admin_super_secret_key_2026';

// Middleware for Parent App APIs
function authenticateParent(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Missing or invalid Authorization header.'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please log in again.'
    });
  }
}

// Middleware for Admin Dashboard APIs
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Admin access denied. Missing or invalid Authorization header.'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);
    req.admin = decoded; // Contains { id, email, role, full_name }
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired admin session. Please log in again.'
    });
  }
}

// Role-Based Access Control (RBAC) Helper
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    // SUPER_ADMIN has access to everything
    if (req.admin.role === 'SUPER_ADMIN' || allowedRoles.includes(req.admin.role)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      message: `Permission denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.admin.role}`
    });
  };
}

module.exports = {
  authenticateParent,
  authenticateAdmin,
  requireRole,
  JWT_SECRET,
  ADMIN_JWT_SECRET
};

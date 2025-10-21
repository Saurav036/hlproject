'use strict';

const jwt = require('jsonwebtoken');

// Use a strong secret in production - should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'wyldtrace-secret-key-change-in-production';
const JWT_EXPIRY = '24h';

/**
 * Generate JWT token for a user
 */
const generateToken = (userID, userRole, additionalData = {}) => {
    const payload = {
        userID,
        userRole,
        ...additionalData,
        iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

/**
 * Verify JWT token middleware
 */
const verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'No authorization token provided'
            });
        }

        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader;

        const decoded = jwt.verify(token, JWT_SECRET);

        // Attach user info to request object
        req.user = {
            userID: decoded.userID,
            userRole: decoded.userRole,
            organizationName: decoded.organizationName,
            location: decoded.location
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired'
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

/**
 * Role-based authorization middleware
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const userRole = req.user.userRole.toLowerCase();

        // Admin has access to everything
        if (userRole === 'admin') {
            return next();
        }

        const hasPermission = allowedRoles.some(role =>
            userRole === role.toLowerCase()
        );

        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
                userRole: req.user.userRole
            });
        }

        next();
    };
};

/**
 * Role permissions configuration
 */
const ROLE_PERMISSIONS = {
    farmer: {
        name: 'Farmer',
        description: 'Agricultural producers and growers',
        permissions: [
            'Create products (crops, livestock, raw materials)',
            'Update own product locations',
            'View own products and their history',
            'Transfer ownership to manufacturers/distributors',
        ],
        color: '#4caf50'
    },
    manufacturer: {
        name: 'Manufacturer',
        description: 'Processing and manufacturing facilities',
        permissions: [
            'Process raw products into finished goods',
            'Update product status and locations',
            'Add quality certifications',
            'Transfer ownership to distributors/retailers',
            'View product lineage and history',
        ],
        color: '#2196f3'
    },
    distributor: {
        name: 'Distributor',
        description: 'Logistics and distribution companies',
        permissions: [
            'Create and manage shipments',
            'Update product locations during transit',
            'Track temperature and humidity',
            'Transfer ownership to retailers',
            'View shipment analytics',
        ],
        color: '#ff9800'
    },
    retailer: {
        name: 'Retailer',
        description: 'Retail stores and outlets',
        permissions: [
            'Receive products from distributors',
            'Update product status (AT_RETAILER, SOLD)',
            'View complete product history',
            'Mark products as sold',
            'Generate QR codes for consumers',
        ],
        color: '#9c27b0'
    },
    shipper: {
        name: 'Shipper',
        description: 'Transportation and logistics providers',
        permissions: [
            'Update product locations',
            'Add temperature/humidity readings',
            'Update shipment status',
            'Track delivery progress',
            'Report quality issues',
        ],
        color: '#f44336'
    },
    admin: {
        name: 'Administrator',
        description: 'System administrators with full access',
        permissions: [
            'Register new participants (all roles)',
            'View all products and transactions',
            'Access supply chain analytics',
            'Manage system configuration',
            'Full read/write access to all operations',
        ],
        color: '#607d8b'
    }
};

/**
 * Get role information
 */
const getRoleInfo = (role) => {
    const roleLower = role.toLowerCase();
    return ROLE_PERMISSIONS[roleLower] || null;
};

/**
 * Get all roles information
 */
const getAllRoles = () => {
    return ROLE_PERMISSIONS;
};

module.exports = {
    generateToken,
    verifyToken,
    requireRole,
    getRoleInfo,
    getAllRoles,
    ROLE_PERMISSIONS,
    JWT_SECRET
};

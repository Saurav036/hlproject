'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');

const helper = require('./helper');
const invoke = require('./invoke');
const query = require('./query');
const { generateToken, verifyToken, requireRole, getAllRoles } = require('./authMiddleware');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://90.247.172.96:3001'],
    credentials: true
}));

// Initialize Supply Chain Organizations
async function initFarmerOrg() {
    try {
        const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const identity = await wallet.get('farmerAdmin');
        if (identity) {
            console.log('Farmer admin already exists in the wallet');
            return;
        }

        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put('farmerAdmin', x509Identity);
        console.log('Successfully enrolled farmer admin');
    } catch (error) {
        console.error(`Failed to enroll farmer admin: ${error}`);
        process.exit(1);
    }
}

async function initManufacturerOrg() {
    try {
        const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org2.example.com', 'connection-org2.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const caInfo = ccp.certificateAuthorities['ca.org2.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const identity = await wallet.get('manufacturerAdmin');
        if (identity) {
            console.log('Manufacturer admin already exists in the wallet');
            return;
        }

        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org2MSP',
            type: 'X.509',
        };
        await wallet.put('manufacturerAdmin', x509Identity);
        console.log('Successfully enrolled manufacturer admin');
    } catch (error) {
        console.error(`Failed to enroll manufacturer admin: ${error}`);
        process.exit(1);
    }
}

// API Endpoints

// Initialize the network
app.get('/init', async (req, res, next) => {
    console.log('\n=== [/init] Network Initialization Started ===');
    try {
        console.log('[/init] Step 1: Initializing Farmer Organization...');
        await initFarmerOrg();
        console.log('[/init] Step 2: Initializing Manufacturer Organization...');
        await initManufacturerOrg();
        console.log('[/init] ✅ Network initialized successfully');
        res.json({ success: true, message: 'Network initialized successfully' });
    } catch (error) {
        console.error('[/init] ❌ Error during initialization:', error.message);
        next(error);
    }
});

const users = [];

// --- Routes ---

/**
 * @route   GET /roles
 * @desc    Get all role definitions and permissions
 * @access  Public
 */
app.get('/roles', (req, res) => {
    console.log('\n=== [GET /roles] Fetching all role definitions ===');
    try {
        const roles = getAllRoles();
        console.log('[GET /roles] ✅ Successfully retrieved', Object.keys(roles).length, 'roles');
        res.status(200).json({
            success: true,
            roles
        });
    } catch (error) {
        console.error('[GET /roles] ❌ Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route   POST /register
 * @desc    Register a new user
 * @access  Public
 */
app.post('/register', (req, res) => {
    console.log('\n=== [POST /register] User Registration Started ===');
    const { adminID, userID, userRole } = req.body;
    console.log('[POST /register] Request body:', { adminID, userID, userRole });

    // Basic validation
    if (!userID || !userRole) {
        console.log('[POST /register] ❌ Validation failed: Missing userID or userRole');
        return res.status(400).json({ message: 'UserID and UserRole are required.' });
    }

    // Check if user already exists
    const existingUser = users.find(user => user.userID === userID);
    if (existingUser) {
        console.log('[POST /register] ❌ User already exists:', userID);
        return res.status(409).json({ message: 'User already exists.' });
    }

    // In a real app, you would validate the adminID here to ensure
    // only an admin can register new users. We'll skip that for this example.
    console.log('[POST /register] Registration initiated by admin:', adminID);

    const newUser = {
        userID,
        userRole,
    };

    users.push(newUser);
    console.log('[POST /register] ✅ User registered successfully');
    console.log('[POST /register] Current users count:', users.length);

    res.status(201).json({
        message: 'User registered successfully',
        userID: newUser.userID,
    });
});
// Register a new participant in the supply chain
app.post('/registerParticipant', async (req, res, next) => {
    console.log('\n=== [POST /registerParticipant] Participant Registration Started ===');
    try {
        const { adminId, userId, role, organizationName, location, contact } = req.body;
        console.log('[POST /registerParticipant] Request body:', { adminId, userId, role, organizationName, location, contact });

        if (!userId || !adminId || !role) {
            console.log('[POST /registerParticipant] ❌ Validation failed: Missing required fields');
            throw new Error('Missing required fields: userId, adminId, and role are required');
        }

        // Validate role
        const validRoles = ['farmer', 'manufacturer', 'distributor', 'retailer', 'shipper'];
        if (!validRoles.includes(role)) {
            console.log('[POST /registerParticipant] ❌ Invalid role:', role);
            throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
        }

        console.log('[POST /registerParticipant] Calling helper.registerUser...');
        const result = await helper.registerUser(adminId, userId, role, {
            organizationName,
            location,
            contact
        });

        console.log('[POST /registerParticipant] ✅ Participant registered successfully');
        console.log('[POST /registerParticipant] Result:', result);
        res.status(200).json(result);
    } catch (error) {
        console.error('[POST /registerParticipant] ❌ Error:', error.message);
        console.error('[POST /registerParticipant] Stack trace:', error.stack);
        next(error);
    }
});

// Login participant with JWT
app.post('/login', async (req, res, next) => {
    console.log('\n=== [POST /login] Login Attempt Started ===');
    try {
        const { userId } = req.body;
        console.log('[POST /login] Request body:', { userId });

        if (!userId) {
            console.log('[POST /login] ❌ Validation failed: Missing userId');
            throw new Error('Missing required field: userId');
        }

        console.log('[POST /login] Step 1: Calling helper.login...');
        const result = await helper.login(userId);
        console.log('[POST /login] Step 2: Helper.login result:', { success: result.success, statusCode: result.statusCode });

        if (result.success) {
            console.log('[POST /login] Step 3: Generating JWT token...');
            const token = generateToken(
                result.userID,
                result.participant.role,
                {
                    organizationName: result.participant.organizationName,
                    location: result.participant.location
                }
            );

            console.log('[POST /login] ✅ Login successful for user:', result.userID, 'with role:', result.participant.role);
            res.status(200).json({
                success: true,
                token,
                userID: result.userID,
                userRole: result.participant.role,
                participant: result.participant,
                message: 'Login successful'
            });
        } else {
            console.log('[POST /login] ❌ Login failed:', result.message);
            res.status(result.statusCode || 401).json(result);
        }
    } catch (error) {
        console.error('[POST /login] ❌ Error during login:', error.message);
        console.error('[POST /login] Stack trace:', error.stack);
        next(error);
    }
});

// Create a new product (Farmers only)
app.post('/createProduct', verifyToken, requireRole('farmer', 'admin'), async (req, res, next) => {
    console.log('\n=== [POST /createProduct] Create Product Started ===');
    try {
        const { productName, productType, quantity, unit, harvestDate, location, certifications } = req.body;
        const userId = req.user.userID; // Get from JWT token
        console.log('[POST /createProduct] Authenticated user:', userId, 'Role:', req.user.userRole);
        console.log('[POST /createProduct] Request body:', { productName, productType, quantity, unit, harvestDate, location });

        if (!productName || !productType || !quantity) {
            console.log('[POST /createProduct] ❌ Validation failed: Missing required fields');
            throw new Error('Missing required fields');
        }

        const args = {
            productName,
            productType,
            quantity,
            unit: unit || 'kg',
            harvestDate: harvestDate || new Date().toISOString(),
            location,
            certifications: certifications || [],
            status: 'CREATED'
        };

        console.log('[POST /createProduct] Calling blockchain invoke.invokeTransaction...');
        const result = await invoke.invokeTransaction('createProduct', args, userId);
        console.log('[POST /createProduct] ✅ Product created successfully');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[POST /createProduct] ❌ Error:', error.message);
        console.error('[POST /createProduct] Stack trace:', error.stack);
        next(error);
    }
});

// Update product location (Shippers, Distributors)
app.post('/updateLocation', verifyToken, requireRole('shipper', 'distributor', 'admin'), async (req, res, next) => {
    console.log('\n=== [POST /updateLocation] Update Location Started ===');
    try {
        const { productId, location, temperature, humidity, timestamp } = req.body;
        const userId = req.user.userID;
        console.log('[POST /updateLocation] Authenticated user:', userId, 'Role:', req.user.userRole);
        console.log('[POST /updateLocation] Request body:', { productId, location, temperature, humidity });

        if (!productId || !location) {
            console.log('[POST /updateLocation] ❌ Validation failed: Missing productId or location');
            throw new Error('Missing required fields');
        }

        const args = {
            productId,
            location,
            temperature,
            humidity,
            timestamp: timestamp || new Date().toISOString()
        };

        console.log('[POST /updateLocation] Calling blockchain invoke.invokeTransaction...');
        const result = await invoke.invokeTransaction('updateLocation', args, userId);
        console.log('[POST /updateLocation] ✅ Location updated successfully');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[POST /updateLocation] ❌ Error:', error.message);
        console.error('[POST /updateLocation] Stack trace:', error.stack);
        next(error);
    }
});

// Transfer ownership (All authenticated users can transfer their own products)
app.post('/transferOwnership', verifyToken, async (req, res, next) => {
    console.log('\n=== [POST /transferOwnership] Transfer Ownership Started ===');
    try {
        const { productId, newOwnerId, price, notes } = req.body;
        const userId = req.user.userID;
        console.log('[POST /transferOwnership] Authenticated user:', userId, 'Role:', req.user.userRole);
        console.log('[POST /transferOwnership] Request body:', { productId, newOwnerId, price, notes });

        if (!productId || !newOwnerId) {
            console.log('[POST /transferOwnership] ❌ Validation failed: Missing productId or newOwnerId');
            throw new Error('Missing required fields');
        }

        const args = {
            productId,
            newOwnerId,
            price,
            notes,
            timestamp: new Date().toISOString()
        };

        console.log('[POST /transferOwnership] Calling blockchain invoke.invokeTransaction...');
        const result = await invoke.invokeTransaction('transferOwnership', args, userId);
        console.log('[POST /transferOwnership] ✅ Ownership transferred successfully');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[POST /transferOwnership] ❌ Error:', error.message);
        console.error('[POST /transferOwnership] Stack trace:', error.stack);
        next(error);
    }
});

// Process product (Manufacturers only)
app.post('/processProduct', verifyToken, requireRole('manufacturer', 'admin'), async (req, res, next) => {
    try {
        const { inputProductIds, outputProductName, outputQuantity, processingDetails } = req.body;
        const userId = req.user.userID;

        if (!inputProductIds || !outputProductName || !outputQuantity) {
            throw new Error('Missing required fields');
        }

        const args = {
            inputProductIds,
            outputProductName,
            outputQuantity,
            processingDetails,
            timestamp: new Date().toISOString()
        };

        const result = await invoke.invokeTransaction('processProduct', args, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error processing product:', error);
        next(error);
    }
});

// Add quality certification (Manufacturers, Retailers)
app.post('/addCertification', verifyToken, requireRole('manufacturer', 'retailer', 'admin'), async (req, res, next) => {
    try {
        const { productId, certificationType, certificationBody, expiryDate, details } = req.body;
        const userId = req.user.userID;

        if (!productId || !certificationType || !certificationBody) {
            throw new Error('Missing required fields');
        }

        const args = {
            productId,
            certificationType,
            certificationBody,
            expiryDate,
            details,
            issuedDate: new Date().toISOString()
        };

        const result = await invoke.invokeTransaction('addCertification', args, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error adding certification:', error);
        next(error);
    }
});

// Query product by ID (Authenticated users)
app.get('/getProduct/:productId', verifyToken, async (req, res, next) => {
    try {
        const { productId } = req.params;
        const userId = req.user.userID;

        if (!productId) {
            throw new Error('Missing required parameters');
        }

        const result = await query.getQuery('getProduct', { productId }, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting product:', error);
        next(error);
    }
});

// Get product history (Authenticated users)
app.get('/getProductHistory/:productId', verifyToken, async (req, res, next) => {
    try {
        const { productId } = req.params;
        const userId = req.user.userID;

        if (!productId) {
            throw new Error('Missing required parameters');
        }

        const result = await query.getQuery('getProductHistory', { productId }, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting product history:', error);
        next(error);
    }
});

// Get all products by owner (Authenticated users)
app.get('/getProductsByOwner', verifyToken, async (req, res, next) => {
    try {
        const { ownerId } = req.query;
        const userId = req.user.userID;

        if (!ownerId) {
            throw new Error('Missing required parameters');
        }

        const result = await query.getQuery('getProductsByOwner', { ownerId }, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting products by owner:', error);
        next(error);
    }
});

// Get products by status
app.get('/getProductsByStatus', async (req, res, next) => {
    try {
        const { userId, status } = req.query;
        
        if (!userId || !status) {
            throw new Error('Missing required parameters');
        }

        const result = await query.getQuery('getProductsByStatus', { status }, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting products by status:', error);
        next(error);
    }
});

// Get supply chain analytics
app.get('/getSupplyChainAnalytics', async (req, res, next) => {
    try {
        const { userId, startDate, endDate } = req.query;
        
        if (!userId) {
            throw new Error('Missing required parameter: userId');
        }

        const args = {
            startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: endDate || new Date().toISOString()
        };

        const result = await query.getQuery('getSupplyChainAnalytics', args, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting analytics:', error);
        next(error);
    }
});

// Verify product authenticity (Public endpoint)
app.get('/verifyProduct/:productId', async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { qrCode } = req.query;
        
        if (!productId) {
            throw new Error('Missing required parameter: productId');
        }

        // Use a public user identity for verification
        const result = await query.getQuery('verifyProduct', { productId, qrCode }, 'publicUser');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error verifying product:', error);
        next(error);
    }
});

// Get all products (Admin only)
app.get('/getAllProducts', async (req, res, next) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            throw new Error('Missing required parameter: userId');
        }

        const result = await query.getQuery('getAllProducts', {}, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting all products:', error);
        next(error);
    }
});

// Health check
app.get('/status', (req, res) => {
    res.json({ status: 'UP', message: 'Product tracing server is running', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 400).json({
        success: false,
        error: err.message || 'An error occurred'
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Product tracing server is running on port ${PORT}`);
});
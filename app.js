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
    origin: ['*','http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://90.247.172.96:3001'],
    credentials: true
}));

// Logging middleware - logs all incoming requests
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    console.log(`${'='.repeat(80)}`);
    if (Object.keys(req.body).length > 0) {
        console.log('Request Body:', JSON.stringify(req.body, null, 2));
    }
    if (Object.keys(req.query).length > 0) {
        console.log('Query Params:', JSON.stringify(req.query, null, 2));
    }
    if (req.headers.authorization) {
        console.log('Authorization:', req.headers.authorization.substring(0, 20) + '...');
    }
    next();
});

// Initialize Supply Chain Organizations
async function initFarmerOrg() {
    console.log('[initFarmerOrg] Starting initialization...');
    try {
        const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        console.log('[initFarmerOrg] Connection profile path:', ccpPath);
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        const walletPath = path.join(process.cwd(), 'wallet');
        console.log('[initFarmerOrg] Wallet path:', walletPath);
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const identity = await wallet.get('farmerAdmin');
        if (identity) {
            console.log('[initFarmerOrg] ✅ Farmer admin already exists in the wallet');
            return;
        }

        console.log('[initFarmerOrg] Enrolling farmer admin...');
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
        console.log('[initFarmerOrg] ✅ Successfully enrolled farmer admin');
    } catch (error) {
        console.error('[initFarmerOrg] ❌ Failed to enroll farmer admin:', error.message);
        console.error('[initFarmerOrg] Stack trace:', error.stack);
        process.exit(1);
    }
}

async function initManufacturerOrg() {
    console.log('[initManufacturerOrg] Starting initialization...');
    try {
        const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org2.example.com', 'connection-org2.json');
        console.log('[initManufacturerOrg] Connection profile path:', ccpPath);
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        const caInfo = ccp.certificateAuthorities['ca.org2.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        const walletPath = path.join(process.cwd(), 'wallet');
        console.log('[initManufacturerOrg] Wallet path:', walletPath);
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const identity = await wallet.get('manufacturerAdmin');
        if (identity) {
            console.log('[initManufacturerOrg] ✅ Manufacturer admin already exists in the wallet');
            return;
        }

        console.log('[initManufacturerOrg] Enrolling manufacturer admin...');
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
        console.log('[initManufacturerOrg] ✅ Successfully enrolled manufacturer admin');
    } catch (error) {
        console.error('[initManufacturerOrg] ❌ Failed to enroll manufacturer admin:', error.message);
        console.error('[initManufacturerOrg] Stack trace:', error.stack);
        process.exit(1);
    }
}

// API Endpoints

// Initialize the network
app.get('/init', async (req, res, next) => {
    console.log('[GET /init] Network initialization requested');
    try {
        console.log('[GET /init] Step 1/2: Initializing Farmer Organization...');
        await initFarmerOrg();
        console.log('[GET /init] Step 2/2: Initializing Manufacturer Organization...');
        await initManufacturerOrg();
        console.log('[GET /init] ✅ Network initialized successfully');
        res.json({ success: true, message: 'Network initialized successfully' });
    } catch (error) {
        console.error('[GET /init] ❌ Initialization failed:', error.message);
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
    console.log('[GET /roles] Fetching role definitions');
    try {
        const roles = getAllRoles();
        console.log('[GET /roles] ✅ Retrieved', Object.keys(roles).length, 'roles');
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
    console.log('[POST /register] User registration attempt');
    const { adminID, userID, userRole } = req.body;

    // Basic validation
    if (!userID || !userRole) {
        console.log('[POST /register] ❌ Validation failed: Missing required fields');
        return res.status(400).json({ message: 'UserID and UserRole are required.' });
    }

    // Check if user already exists
    const existingUser = users.find(user => user.userID === userID);
    if (existingUser) {
        console.log('[POST /register] ❌ User already exists:', userID);
        return res.status(409).json({ message: 'User already exists.' });
    }

    console.log('[POST /register] Creating user:', userID, 'with role:', userRole);
    const newUser = {
        userID,
        userRole,
    };

    users.push(newUser);
    console.log('[POST /register] ✅ User registered. Total users:', users.length);

    res.status(201).json({
        message: 'User registered successfully',
        userID: newUser.userID,
    });
});

// Register a new participant in the supply chain
app.post('/registerParticipant', async (req, res, next) => {
    console.log('[POST /registerParticipant] Blockchain participant registration');
    try {
        const { adminId, userId, role, organizationName, location, contact } = req.body;

        if (!userId || !adminId || !role) {
            console.log('[POST /registerParticipant] ❌ Missing required fields');
            throw new Error('Missing required fields: userId, adminId, and role are required');
        }

        // Validate role
        const validRoles = ['farmer', 'manufacturer', 'distributor', 'retailer', 'shipper'];
        if (!validRoles.includes(role)) {
            console.log('[POST /registerParticipant] ❌ Invalid role:', role);
            throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
        }

        console.log('[POST /registerParticipant] Calling helper.registerUser for:', userId);
        const result = await helper.registerUser(adminId, userId, role, {
            organizationName,
            location,
            contact
        });

        console.log('[POST /registerParticipant] ✅ Success:', result.message);
        res.status(200).json(result);
    } catch (error) {
        console.error('[POST /registerParticipant] ❌ Error:', error.message);
        console.error('[POST /registerParticipant] Stack:', error.stack);
        next(error);
    }
});

// Login participant with JWT
app.post('/login', async (req, res, next) => {
    console.log('[POST /login] Login attempt started');
    try {
        const { userId } = req.body;

        if (!userId) {
            console.log('[POST /login] ❌ Missing userId');
            throw new Error('Missing required field: userId');
        }

        console.log('[POST /login] Authenticating user:', userId);
        const result = await helper.login(userId);

        if (result.success) {
            console.log('[POST /login] User authenticated, generating JWT...');
            const token = generateToken(
                result.userID,
                result.participant.role,
                {
                    organizationName: result.participant.organizationName,
                    location: result.participant.location
                }
            );

            console.log('[POST /login] ✅ Login successful for:', result.userID, '| Role:', result.participant.role);
            res.status(200).json({
                success: true,
                token,
                userID: result.userID,
                userRole: result.participant.role,
                participant: result.participant,
                message: 'Login successful'
            });
        } else {
            console.log('[POST /login] ❌ Authentication failed:', result.message);
            res.status(result.statusCode || 401).json(result);
        }
    } catch (error) {
        console.error('[POST /login] ❌ Login error:', error.message);
        console.error('[POST /login] Stack:', error.stack);
        next(error);
    }
});

// Create a new product (Farmers only)
app.post('/createProduct', verifyToken, requireRole('farmer', 'admin'), async (req, res, next) => {
    console.log('[POST /createProduct] Product creation request');
    try {
        const { productName, productType, quantity, unit, harvestDate, location, certifications } = req.body;
        const userId = req.user.userID;
        console.log('[POST /createProduct] User:', userId, '| Role:', req.user.userRole);

        if (!productName || !productType || !quantity) {
            console.log('[POST /createProduct] ❌ Missing required fields');
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

        console.log('[POST /createProduct] Invoking blockchain transaction...');
        const result = await invoke.invokeTransaction('createProduct', args, userId);
        console.log('[POST /createProduct] ✅ Product created successfully');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[POST /createProduct] ❌ Error:', error.message);
        console.error('[POST /createProduct] Stack:', error.stack);
        next(error);
    }
});

// Update product location (Shippers, Distributors)
app.post('/updateLocation', verifyToken, requireRole('shipper', 'distributor', 'admin'), async (req, res, next) => {
    console.log('[POST /updateLocation] Location update request');
    try {
        const { productId, location, temperature, humidity, timestamp } = req.body;
        const userId = req.user.userID;
        console.log('[POST /updateLocation] User:', userId, '| Product:', productId);

        if (!productId || !location) {
            console.log('[POST /updateLocation] ❌ Missing productId or location');
            throw new Error('Missing required fields');
        }

        const args = {
            productId,
            location,
            temperature,
            humidity,
            timestamp: timestamp || new Date().toISOString()
        };

        console.log('[POST /updateLocation] Invoking blockchain transaction...');
        const result = await invoke.invokeTransaction('updateLocation', args, userId);
        console.log('[POST /updateLocation] ✅ Location updated');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[POST /updateLocation] ❌ Error:', error.message);
        console.error('[POST /updateLocation] Stack:', error.stack);
        next(error);
    }
});

// Transfer ownership
app.post('/transferOwnership', verifyToken, async (req, res, next) => {
    console.log('[POST /transferOwnership] Ownership transfer request');
    try {
        const { productId, newOwnerId, price, notes } = req.body;
        const userId = req.user.userID;
        console.log('[POST /transferOwnership] From:', userId, '| To:', newOwnerId, '| Product:', productId);

        if (!productId || !newOwnerId) {
            console.log('[POST /transferOwnership] ❌ Missing productId or newOwnerId');
            throw new Error('Missing required fields');
        }

        const args = {
            productId,
            newOwnerId,
            price,
            notes,
            timestamp: new Date().toISOString()
        };

        console.log('[POST /transferOwnership] Invoking blockchain transaction...');
        const result = await invoke.invokeTransaction('transferOwnership', args, userId);
        console.log('[POST /transferOwnership] ✅ Ownership transferred');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[POST /transferOwnership] ❌ Error:', error.message);
        console.error('[POST /transferOwnership] Stack:', error.stack);
        next(error);
    }
});

// Process product (Manufacturers only)
app.post('/processProduct', verifyToken, requireRole('manufacturer', 'admin'), async (req, res, next) => {
    console.log('[POST /processProduct] Product processing request');
    try {
        const { inputProductIds, outputProductName, outputQuantity, processingDetails } = req.body;
        const userId = req.user.userID;
        console.log('[POST /processProduct] User:', userId, '| Output:', outputProductName);

        if (!inputProductIds || !outputProductName || !outputQuantity) {
            console.log('[POST /processProduct] ❌ Missing required fields');
            throw new Error('Missing required fields');
        }

        const args = {
            inputProductIds,
            outputProductName,
            outputQuantity,
            processingDetails,
            timestamp: new Date().toISOString()
        };

        console.log('[POST /processProduct] Invoking blockchain transaction...');
        const result = await invoke.invokeTransaction('processProduct', args, userId);
        console.log('[POST /processProduct] ✅ Product processed');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[POST /processProduct] ❌ Error:', error.message);
        console.error('[POST /processProduct] Stack:', error.stack);
        next(error);
    }
});

// Add quality certification
app.post('/addCertification', verifyToken, requireRole('manufacturer', 'retailer', 'admin'), async (req, res, next) => {
    console.log('[POST /addCertification] Add certification request');
    try {
        const { productId, certificationType, certificationBody, expiryDate, details } = req.body;
        const userId = req.user.userID;
        console.log('[POST /addCertification] User:', userId, '| Product:', productId, '| Type:', certificationType);

        if (!productId || !certificationType || !certificationBody) {
            console.log('[POST /addCertification] ❌ Missing required fields');
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

        console.log('[POST /addCertification] Invoking blockchain transaction...');
        const result = await invoke.invokeTransaction('addCertification', args, userId);
        console.log('[POST /addCertification] ✅ Certification added');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[POST /addCertification] ❌ Error:', error.message);
        console.error('[POST /addCertification] Stack:', error.stack);
        next(error);
    }
});

// Query product by ID
app.get('/getProduct/:productId', verifyToken, async (req, res, next) => {
    console.log('[GET /getProduct] Query product by ID');
    try {
        const { productId } = req.params;
        const userId = req.user.userID;
        console.log('[GET /getProduct] User:', userId, '| Product:', productId);

        if (!productId) {
            console.log('[GET /getProduct] ❌ Missing productId');
            throw new Error('Missing required parameters');
        }

        console.log('[GET /getProduct] Querying blockchain...');
        const result = await query.getQuery('getProduct', { productId }, userId);
        console.log('[GET /getProduct] ✅ Product retrieved');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[GET /getProduct] ❌ Error:', error.message);
        console.error('[GET /getProduct] Stack:', error.stack);
        next(error);
    }
});

// Get product history
app.get('/getProductHistory/:productId', verifyToken, async (req, res, next) => {
    console.log('[GET /getProductHistory] Query product history');
    try {
        const { productId } = req.params;
        const userId = req.user.userID;
        console.log('[GET /getProductHistory] User:', userId, '| Product:', productId);

        if (!productId) {
            console.log('[GET /getProductHistory] ❌ Missing productId');
            throw new Error('Missing required parameters');
        }

        console.log('[GET /getProductHistory] Querying blockchain...');
        const result = await query.getQuery('getProductHistory', { productId }, userId);
        console.log('[GET /getProductHistory] ✅ History retrieved');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[GET /getProductHistory] ❌ Error:', error.message);
        console.error('[GET /getProductHistory] Stack:', error.stack);
        next(error);
    }
});

// Get all products by owner
app.get('/getProductsByOwner', verifyToken, async (req, res, next) => {
    console.log('[GET /getProductsByOwner] Query products by owner');
    try {
        const { ownerId } = req.query;
        const userId = req.user.userID;
        console.log('[GET /getProductsByOwner] User:', userId, '| Owner:', ownerId);

        if (!ownerId) {
            console.log('[GET /getProductsByOwner] ❌ Missing ownerId');
            throw new Error('Missing required parameters');
        }

        console.log('[GET /getProductsByOwner] Querying blockchain...');
        const result = await query.getQuery('getProductsByOwner', { ownerId }, userId);
        console.log('[GET /getProductsByOwner] ✅ Products retrieved');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[GET /getProductsByOwner] ❌ Error:', error.message);
        console.error('[GET /getProductsByOwner] Stack:', error.stack);
        next(error);
    }
});

// Get products by status
app.get('/getProductsByStatus', verifyToken, async (req, res, next) => {
    console.log('[GET /getProductsByStatus] Query products by status');
    try {
        const { status } = req.query;
        const userId = req.user.userID;
        console.log('[GET /getProductsByStatus] User:', userId, '| Status:', status);

        if (!status) {
            console.log('[GET /getProductsByStatus] ❌ Missing status');
            throw new Error('Missing required parameters');
        }

        console.log('[GET /getProductsByStatus] Querying blockchain...');
        const result = await query.getQuery('getProductsByStatus', { status }, userId);
        console.log('[GET /getProductsByStatus] ✅ Products retrieved');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[GET /getProductsByStatus] ❌ Error:', error.message);
        console.error('[GET /getProductsByStatus] Stack:', error.stack);
        next(error);
    }
});

// Get supply chain analytics
app.get('/getSupplyChainAnalytics', verifyToken, async (req, res, next) => {
    console.log('[GET /getSupplyChainAnalytics] Query analytics');
    try {
        const { startDate, endDate } = req.query;
        const userId = req.user.userID;
        console.log('[GET /getSupplyChainAnalytics] User:', userId);

        const args = {
            startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: endDate || new Date().toISOString()
        };

        console.log('[GET /getSupplyChainAnalytics] Querying blockchain...');
        const result = await query.getQuery('getSupplyChainAnalytics', args, userId);
        console.log('[GET /getSupplyChainAnalytics] ✅ Analytics retrieved');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[GET /getSupplyChainAnalytics] ❌ Error:', error.message);
        console.error('[GET /getSupplyChainAnalytics] Stack:', error.stack);
        next(error);
    }
});

// Verify product authenticity (Public endpoint)
app.get('/verifyProduct/:productId', async (req, res, next) => {
    console.log('[GET /verifyProduct] Public product verification');
    try {
        const { productId } = req.params;
        const { qrCode } = req.query;
        console.log('[GET /verifyProduct] Product:', productId, '| QR:', qrCode);

        if (!productId) {
            console.log('[GET /verifyProduct] ❌ Missing productId');
            throw new Error('Missing required parameter: productId');
        }

        console.log('[GET /verifyProduct] Querying blockchain...');
        const result = await query.getQuery('verifyProduct', { productId, qrCode }, 'publicUser');
        console.log('[GET /verifyProduct] ✅ Verification complete');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[GET /verifyProduct] ❌ Error:', error.message);
        console.error('[GET /verifyProduct] Stack:', error.stack);
        next(error);
    }
});

// Get all products (Admin only)
app.get('/getAllProducts', verifyToken, requireRole('admin'), async (req, res, next) => {
    console.log('[GET /getAllProducts] Query all products (admin)');
    try {
        const userId = req.user.userID;
        console.log('[GET /getAllProducts] Admin user:', userId);

        console.log('[GET /getAllProducts] Querying blockchain...');
        const result = await query.getQuery('getAllProducts', {}, userId);
        console.log('[GET /getAllProducts] ✅ All products retrieved');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('[GET /getAllProducts] ❌ Error:', error.message);
        console.error('[GET /getAllProducts] Stack:', error.stack);
        next(error);
    }
});

// Health check
app.get('/status', (req, res) => {
    console.log('[GET /status] Health check requested');
    res.json({ status: 'UP', message: 'Product tracing server is running', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('\n❌ ERROR HANDLER CAUGHT:');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    res.status(err.status || 400).json({
        success: false,
        error: err.message || 'An error occurred'
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 Product tracing server is running');
    console.log('📍 Port:', PORT);
    console.log('🕐 Started at:', new Date().toISOString());
    console.log('='.repeat(80) + '\n');
});

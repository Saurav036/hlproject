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

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({ origins: ['*', 'http://localhost:3000', 'http://localhost:3001'] }));

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
    try {
        await initFarmerOrg();
        await initManufacturerOrg();
        res.json({ success: true, message: 'Network initialized successfully' });
    } catch (error) {
        next(error);
    }
});

// Register a new participant in the supply chain
app.post('/registerParticipant', async (req, res, next) => {
    try {
        const { adminId, userId, role, organizationName, location, contact } = req.body;
        
        if (!userId || !adminId || !role) {
            throw new Error('Missing required fields: userId, adminId, and role are required');
        }

        // Validate role
        const validRoles = ['farmer', 'manufacturer', 'distributor', 'retailer', 'shipper'];
        if (!validRoles.includes(role)) {
            throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
        }

        const result = await helper.registerUser(adminId, userId, role, {
            organizationName,
            location,
            contact
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Error registering participant:', error);
        next(error);
    }
});

// Login participant
app.post('/login', async (req, res, next) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            throw new Error('Missing required field: userId');
        }

        const result = await helper.login(userId);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error during login:', error);
        next(error);
    }
});

// Create a new product (Farmers only)
app.post('/createProduct', async (req, res, next) => {
    try {
        const { userId, productName, productType, quantity, unit, harvestDate, location, certifications } = req.body;
        
        if (!userId || !productName || !productType || !quantity) {
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

        const result = await invoke.invokeTransaction('createProduct', args, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error creating product:', error);
        next(error);
    }
});

// Update product location (Shippers)
app.post('/updateLocation', async (req, res, next) => {
    try {
        const { userId, productId, location, temperature, humidity, timestamp } = req.body;
        
        if (!userId || !productId || !location) {
            throw new Error('Missing required fields');
        }

        const args = {
            productId,
            location,
            temperature,
            humidity,
            timestamp: timestamp || new Date().toISOString()
        };

        const result = await invoke.invokeTransaction('updateLocation', args, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error updating location:', error);
        next(error);
    }
});

// Transfer ownership
app.post('/transferOwnership', async (req, res, next) => {
    try {
        const { userId, productId, newOwnerId, price, notes } = req.body;
        
        if (!userId || !productId || !newOwnerId) {
            throw new Error('Missing required fields');
        }

        const args = {
            productId,
            newOwnerId,
            price,
            notes,
            timestamp: new Date().toISOString()
        };

        const result = await invoke.invokeTransaction('transferOwnership', args, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error transferring ownership:', error);
        next(error);
    }
});

// Process product (Manufacturers)
app.post('/processProduct', async (req, res, next) => {
    try {
        const { userId, inputProductIds, outputProductName, outputQuantity, processingDetails } = req.body;
        
        if (!userId || !inputProductIds || !outputProductName || !outputQuantity) {
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

// Add quality certification
app.post('/addCertification', async (req, res, next) => {
    try {
        const { userId, productId, certificationType, certificationBody, expiryDate, details } = req.body;
        
        if (!userId || !productId || !certificationType || !certificationBody) {
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

// Query product by ID
app.get('/getProduct/:productId', async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { userId } = req.query;
        
        if (!userId || !productId) {
            throw new Error('Missing required parameters');
        }

        const result = await query.getQuery('getProduct', { productId }, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting product:', error);
        next(error);
    }
});

// Get product history
app.get('/getProductHistory/:productId', async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { userId } = req.query;
        
        if (!userId || !productId) {
            throw new Error('Missing required parameters');
        }

        const result = await query.getQuery('getProductHistory', { productId }, userId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error getting product history:', error);
        next(error);
    }
});

// Get all products by owner
app.get('/getProductsByOwner', async (req, res, next) => {
    try {
        const { userId, ownerId } = req.query;
        
        if (!userId || !ownerId) {
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
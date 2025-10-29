/*
 * Product Tracing Chaincode - LevelDB Version (Fixed)
 * This chaincode manages the product lifecycle in the supply chain
 * Fixed version with deterministic ID generation
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class ProductTrace extends Contract {

    // Initialize the ledger with sample data
    async initLedger(ctx) {
        console.log('Initializing ledger with sample data');

        const products = [
            {
                productId: 'PROD000001',
                productName: 'Organic Tomatoes',
                productType: 'vegetable',
                currentOwner: 'farmer01',
                quantity: 1000,
                unit: 'kg',
                status: 'CREATED',
                location: 'Green Valley Farms, California',
                temperature: 22,
                humidity: 65,
                harvestDate: '2024-01-15',
                createdAt: '2024-01-15T08:00:00Z',
                certifications: [
                    {
                        type: 'USDA Organic',
                        certificationBody: 'USDA',
                        issuedDate: '2024-01-10',
                        expiryDate: '2025-01-10'
                    }
                ],
                history: [
                    {
                        action: 'CREATED',
                        timestamp: '2024-01-15T08:00:00Z',
                        actor: 'farmer01',
                        details: 'Product created by farmer'
                    }
                ]
            },
            {
                productId: 'PROD000002',
                productName: 'Fresh Strawberries',
                productType: 'fruit',
                currentOwner: 'farmer01',
                quantity: 500,
                unit: 'kg',
                status: 'CREATED',
                location: 'Berry Farm, Oregon',
                temperature: 4,
                humidity: 80,
                harvestDate: '2024-02-01',
                createdAt: '2024-02-01T06:00:00Z',
                certifications: [
                    {
                        type: 'Organic Certified',
                        certificationBody: 'Oregon Tilth',
                        issuedDate: '2024-01-20',
                        expiryDate: '2025-01-20'
                    }
                ],
                history: [
                    {
                        action: 'CREATED',
                        timestamp: '2024-02-01T06:00:00Z',
                        actor: 'farmer01',
                        details: 'Product created by farmer'
                    }
                ]
            },
            {
                productId: 'PROD000003',
                productName: 'Wheat Grain',
                productType: 'grain',
                currentOwner: 'distributor01',
                quantity: 5000,
                unit: 'kg',
                status: 'IN_TRANSIT',
                location: 'Distribution Center, Texas',
                temperature: 18,
                humidity: 55,
                harvestDate: '2024-01-10',
                createdAt: '2024-01-10T10:00:00Z',
                certifications: [],
                history: [
                    {
                        action: 'CREATED',
                        timestamp: '2024-01-10T10:00:00Z',
                        actor: 'farmer02',
                        details: 'Product created by farmer'
                    },
                    {
                        action: 'OWNERSHIP_TRANSFERRED',
                        timestamp: '2024-01-20T12:00:00Z',
                        actor: 'farmer02',
                        details: {
                            from: 'farmer02',
                            to: 'distributor01',
                            price: 5000,
                            notes: 'Transfer to distributor'
                        }
                    }
                ]
            },
            {
                productId: 'PROD000004',
                productName: 'Processed Tomato Sauce',
                productType: 'processed',
                currentOwner: 'manufacturer01',
                quantity: 200,
                unit: 'liter',
                status: 'PROCESSING',
                location: 'Food Processing Plant, California',
                temperature: 25,
                humidity: 60,
                harvestDate: '2024-02-05',
                createdAt: '2024-02-05T14:00:00Z',
                certifications: [
                    {
                        type: 'FDA Approved',
                        certificationBody: 'FDA',
                        issuedDate: '2024-02-01',
                        expiryDate: '2025-02-01'
                    }
                ],
                inputProducts: ['PROD000001'],
                processingDetails: 'Tomatoes processed into sauce',
                history: [
                    {
                        action: 'CREATED',
                        timestamp: '2024-02-05T14:00:00Z',
                        actor: 'manufacturer01',
                        details: 'Product created by manufacturer'
                    }
                ]
            },
            {
                productId: 'PROD000005',
                productName: 'Packaged Lettuce',
                productType: 'vegetable',
                currentOwner: 'retailer01',
                quantity: 300,
                unit: 'box',
                status: 'AT_RETAILER',
                location: 'Retail Store, New York',
                temperature: 5,
                humidity: 75,
                harvestDate: '2024-02-10',
                createdAt: '2024-02-10T07:00:00Z',
                certifications: [],
                history: [
                    {
                        action: 'CREATED',
                        timestamp: '2024-02-10T07:00:00Z',
                        actor: 'farmer03',
                        details: 'Product created by farmer'
                    },
                    {
                        action: 'OWNERSHIP_TRANSFERRED',
                        timestamp: '2024-02-12T10:00:00Z',
                        actor: 'farmer03',
                        details: {
                            from: 'farmer03',
                            to: 'retailer01',
                            price: 1500,
                            notes: 'Transfer to retailer'
                        }
                    }
                ]
            },
            {
                productId: 'PROD000006',
                productName: 'Organic Apples',
                productType: 'fruit',
                currentOwner: 'sysadmin',
                quantity: 800,
                unit: 'kg',
                status: 'PACKAGED',
                location: 'Admin Warehouse',
                temperature: 3,
                humidity: 70,
                harvestDate: '2024-01-25',
                createdAt: '2024-01-25T09:00:00Z',
                certifications: [
                    {
                        type: 'USDA Organic',
                        certificationBody: 'USDA',
                        issuedDate: '2024-01-20',
                        expiryDate: '2025-01-20'
                    }
                ],
                history: [
                    {
                        action: 'CREATED',
                        timestamp: '2024-01-25T09:00:00Z',
                        actor: 'sysadmin',
                        details: 'Product created by admin'
                    }
                ]
            }
        ];

        for (const product of products) {
            await ctx.stub.putState(product.productId, Buffer.from(JSON.stringify(product)));

            // Create composite keys for indexing
            await this.createCompositeKeys(ctx, product);

            console.log(`Added product: ${product.productId}`);
        }

        // Initialize counter for product IDs
        await ctx.stub.putState('productCounter', Buffer.from('7'));

        // Initialize participants
        await this.initParticipants(ctx);
    }

    // Initialize sample participants
    async initParticipants(ctx) {
        const participants = [
            {
                participantId: 'sysadmin',
                role: 'admin',
                organizationName: 'WyldTrace Admin',
                location: 'Headquarters',
                contact: 'admin@wyldtrace.com',
                registeredDate: '2024-01-01',
                status: 'ACTIVE'
            },
            {
                participantId: 'farmer01',
                role: 'farmer',
                organizationName: 'Green Valley Farms',
                location: 'California',
                contact: 'farmer@greenvalley.com',
                registeredDate: '2024-01-01',
                status: 'ACTIVE'
            },
            {
                participantId: 'farmer02',
                role: 'farmer',
                organizationName: 'Sunny Fields Farm',
                location: 'Iowa',
                contact: 'contact@sunnyfields.com',
                registeredDate: '2024-01-01',
                status: 'ACTIVE'
            },
            {
                participantId: 'farmer03',
                role: 'farmer',
                organizationName: 'Fresh Greens Co',
                location: 'Oregon',
                contact: 'info@freshgreens.com',
                registeredDate: '2024-01-01',
                status: 'ACTIVE'
            },
            {
                participantId: 'distributor01',
                role: 'distributor',
                organizationName: 'Fast Distribution Co',
                location: 'Texas',
                contact: 'info@fastdist.com',
                registeredDate: '2024-01-01',
                status: 'ACTIVE'
            },
            {
                participantId: 'manufacturer01',
                role: 'manufacturer',
                organizationName: 'Food Processing Inc',
                location: 'California',
                contact: 'contact@foodprocessing.com',
                registeredDate: '2024-01-01',
                status: 'ACTIVE'
            },
            {
                participantId: 'retailer01',
                role: 'retailer',
                organizationName: 'Fresh Market Store',
                location: 'New York',
                contact: 'sales@freshmarket.com',
                registeredDate: '2024-01-01',
                status: 'ACTIVE'
            }
        ];

        for (const participant of participants) {
            await ctx.stub.putState(`participant_${participant.participantId}`,
                Buffer.from(JSON.stringify(participant)));

            // Create composite key for participants by role
            const roleIndexKey = await ctx.stub.createCompositeKey('role~participant',
                [participant.role, participant.participantId]);
            await ctx.stub.putState(roleIndexKey, Buffer.from('\u0000'));

            console.log(`Added participant: ${participant.participantId}`);
        }
    }

    // Helper function to create composite keys for a product
    async createCompositeKeys(ctx, product) {
        // Create composite key for owner~product index
        const ownerIndexKey = await ctx.stub.createCompositeKey('owner~product', 
            [product.currentOwner, product.productId]);
        await ctx.stub.putState(ownerIndexKey, Buffer.from('\u0000'));
        
        // Create composite key for status~product index
        const statusIndexKey = await ctx.stub.createCompositeKey('status~product', 
            [product.status, product.productId]);
        await ctx.stub.putState(statusIndexKey, Buffer.from('\u0000'));
        
        // Create composite key for type~product index
        const typeIndexKey = await ctx.stub.createCompositeKey('type~product', 
            [product.productType, product.productId]);
        await ctx.stub.putState(typeIndexKey, Buffer.from('\u0000'));
        
        // Create composite key for location~product index
        const locationIndexKey = await ctx.stub.createCompositeKey('location~product', 
            [product.location, product.productId]);
        await ctx.stub.putState(locationIndexKey, Buffer.from('\u0000'));
    }

    // Helper function to delete old composite keys
    async deleteOldCompositeKeys(ctx, product) {
        // Delete old owner index
        const oldOwnerIndexKey = await ctx.stub.createCompositeKey('owner~product', 
            [product.currentOwner, product.productId]);
        await ctx.stub.deleteState(oldOwnerIndexKey);
        
        // Delete old status index
        const oldStatusIndexKey = await ctx.stub.createCompositeKey('status~product', 
            [product.status, product.productId]);
        await ctx.stub.deleteState(oldStatusIndexKey);
        
        // Delete old location index
        const oldLocationIndexKey = await ctx.stub.createCompositeKey('location~product', 
            [product.location, product.productId]);
        await ctx.stub.deleteState(oldLocationIndexKey);
    }

    // FIXED: Deterministic product ID generation
    async generateProductId(ctx, productName, timestamp) {
        // Method 1: Using a counter (most reliable)
        const counterBytes = await ctx.stub.getState('productCounter');
        let counter = 1;
        
        if (counterBytes && counterBytes.length > 0) {
            counter = parseInt(counterBytes.toString());
        }
        
        const productId = `PROD${counter.toString().padStart(6, '0')}`;
        
        // Increment counter for next product
        await ctx.stub.putState('productCounter', Buffer.from((counter + 1).toString()));
        
        return productId;
        
        // Alternative Method 2: Using transaction ID (also deterministic)
        // const txId = ctx.stub.getTxID();
        // const shortId = txId.substring(0, 8).toUpperCase();
        // return `PROD${shortId}`;
        
        // Alternative Method 3: Using hash of inputs (deterministic)
        // const dataToHash = `${productName}-${timestamp}-${ctx.stub.getTxID()}`;
        // const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');
        // return `PROD${hash.substring(0, 10).toUpperCase()}`;
    }

    // Create a new product with FIXED deterministic ID
    async createProduct(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        
        // Get timestamp from transaction
        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTimestamp.seconds.low * 1000).toISOString();
        
        // Generate deterministic product ID
        const productId = await this.generateProductId(ctx, args.productName, timestamp);
        
        // Simplified role checking for LevelDB
        const role = await this.getCallerRole(ctx);
        
        if (role !== 'farmer' && role !== 'manufacturer') {
            // For testing purposes, we'll allow creation if role is not set
            console.log('Warning: Role not properly set, allowing product creation for testing');
        }

        // Get the actual userID (not the full certificate DN)
        const userId = this.getUserId(ctx);

        const product = {
            productId: productId,
            productName: args.productName,
            productType: args.productType,
            currentOwner: args.currentOwner || userId,
            quantity: args.quantity,
            unit: args.unit || 'kg',
            status: 'CREATED',
            location: args.location,
            temperature: null,
            humidity: null,
            harvestDate: args.harvestDate || timestamp,
            createdAt: timestamp,
            certifications: args.certifications || [],
            inputProducts: args.inputProducts || [],
            processingDetails: args.processingDetails || null,
            history: [
                {
                    action: 'CREATED',
                    timestamp: timestamp,
                    actor: userId,
                    details: `Product created by ${role || 'unknown'}`
                }
            ]
        };

        await ctx.stub.putState(productId, Buffer.from(JSON.stringify(product)));
        
        // Create composite keys for indexing
        await this.createCompositeKeys(ctx, product);
        
        // Emit event
        ctx.stub.setEvent('ProductCreated', Buffer.from(JSON.stringify({
            productId: productId,
            owner: product.currentOwner
        })));

        return JSON.stringify({ success: true, productId: productId });
    }

    // Transfer ownership of a product
    async transferOwnership(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { productId, newOwnerId, price, notes } = args;

        const productStr = await this.getProduct(ctx, JSON.stringify({ productId }));
        const product = JSON.parse(productStr);

        // Get deterministic timestamp
        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTimestamp.seconds.low * 1000).toISOString();

        // Store old values for index cleanup
        const oldOwner = product.currentOwner;
        const oldStatus = product.status;

        // Verify current owner (simplified for testing)
        const callerId = this.getUserId(ctx);
        if (product.currentOwner !== callerId && callerId !== 'system') {
            console.log(`Warning: Ownership verification bypassed for testing. Current owner: ${product.currentOwner}, Caller: ${callerId}`);
        }

        // Delete old composite keys
        const oldOwnerIndexKey = await ctx.stub.createCompositeKey('owner~product', 
            [oldOwner, productId]);
        await ctx.stub.deleteState(oldOwnerIndexKey);
        
        const oldStatusIndexKey = await ctx.stub.createCompositeKey('status~product', 
            [oldStatus, productId]);
        await ctx.stub.deleteState(oldStatusIndexKey);

        // Record transfer in history
        product.history.push({
            action: 'OWNERSHIP_TRANSFERRED',
            timestamp: timestamp,
            actor: callerId,
            details: {
                from: product.currentOwner,
                to: newOwnerId,
                price: price,
                notes: notes
            }
        });

        // Update ownership and status
        product.currentOwner = newOwnerId;
        product.status = 'TRANSFERRED';

        // Create new composite keys
        const newOwnerIndexKey = await ctx.stub.createCompositeKey('owner~product', 
            [product.currentOwner, productId]);
        await ctx.stub.putState(newOwnerIndexKey, Buffer.from('\u0000'));
        
        const newStatusIndexKey = await ctx.stub.createCompositeKey('status~product', 
            [product.status, productId]);
        await ctx.stub.putState(newStatusIndexKey, Buffer.from('\u0000'));

        await ctx.stub.putState(productId, Buffer.from(JSON.stringify(product)));

        // Emit event
        ctx.stub.setEvent('OwnershipTransferred', Buffer.from(JSON.stringify({
            productId: productId,
            from: oldOwner,
            to: newOwnerId
        })));

        return JSON.stringify({ success: true, message: 'Ownership transferred successfully' });
    }

    // Update product location
    async updateLocation(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { productId, location, temperature, humidity } = args;

        const role = await this.getCallerRole(ctx);
        if (role !== 'shipper' && role !== 'distributor') {
            console.log('Warning: Role check bypassed for testing');
        }

        const productStr = await this.getProduct(ctx, JSON.stringify({ productId }));
        const product = JSON.parse(productStr);

        // Get deterministic timestamp
        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTimestamp.seconds.low * 1000).toISOString();

        // Store old values for index cleanup
        const oldLocation = product.location;
        const oldStatus = product.status;

        // Delete old composite keys
        const oldLocationIndexKey = await ctx.stub.createCompositeKey('location~product', 
            [oldLocation, productId]);
        await ctx.stub.deleteState(oldLocationIndexKey);
        
        const oldStatusIndexKey = await ctx.stub.createCompositeKey('status~product', 
            [oldStatus, productId]);
        await ctx.stub.deleteState(oldStatusIndexKey);

        // Update location and environmental data
        product.location = location;
        if (temperature !== undefined) product.temperature = temperature;
        if (humidity !== undefined) product.humidity = humidity;
        product.status = 'IN_TRANSIT';

        // Add to history
        product.history.push({
            action: 'LOCATION_UPDATED',
            timestamp: timestamp,
            actor: this.getUserId(ctx),
            details: {
                location: location,
                temperature: temperature,
                humidity: humidity
            }
        });

        // Create new composite keys
        const newLocationIndexKey = await ctx.stub.createCompositeKey('location~product', 
            [product.location, productId]);
        await ctx.stub.putState(newLocationIndexKey, Buffer.from('\u0000'));
        
        const newStatusIndexKey = await ctx.stub.createCompositeKey('status~product', 
            [product.status, productId]);
        await ctx.stub.putState(newStatusIndexKey, Buffer.from('\u0000'));

        await ctx.stub.putState(productId, Buffer.from(JSON.stringify(product)));

        return JSON.stringify({ success: true, message: 'Location updated successfully' });
    }

    // Process products (for manufacturers)
    async processProduct(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { inputProductIds, outputProductName, outputQuantity, processingDetails } = args;

        const role = await this.getCallerRole(ctx);
        if (role !== 'manufacturer') {
            console.log('Warning: Role check bypassed for testing');
        }

        const callerId = this.getUserId(ctx);
        
        // Get deterministic timestamp
        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTimestamp.seconds.low * 1000).toISOString();

        // Verify ownership of all input products
        for (const inputId of inputProductIds) {
            const productStr = await this.getProduct(ctx, JSON.stringify({ productId: inputId }));
            const product = JSON.parse(productStr);
            
            if (product.currentOwner !== callerId && callerId !== 'system') {
                console.log(`Warning: Ownership check bypassed for testing on product ${inputId}`);
            }
            
            // Delete old status index
            const oldStatusIndexKey = await ctx.stub.createCompositeKey('status~product', 
                [product.status, inputId]);
            await ctx.stub.deleteState(oldStatusIndexKey);
            
            // Mark input products as processed
            product.status = 'PROCESSED';
            product.history.push({
                action: 'PROCESSED',
                timestamp: timestamp,
                actor: callerId,
                details: processingDetails
            });
            
            // Create new status index
            const newStatusIndexKey = await ctx.stub.createCompositeKey('status~product', 
                ['PROCESSED', inputId]);
            await ctx.stub.putState(newStatusIndexKey, Buffer.from('\u0000'));
            
            await ctx.stub.putState(inputId, Buffer.from(JSON.stringify(product)));
        }

        // Create new processed product
        const newProductArgs = {
            productName: outputProductName,
            productType: 'processed',
            quantity: outputQuantity,
            unit: 'units',
            location: 'Manufacturing facility',
            currentOwner: callerId,
            certifications: [],
            inputProducts: inputProductIds,
            processingDetails: processingDetails
        };

        return await this.createProduct(ctx, JSON.stringify(newProductArgs));
    }

    // Add certification to a product
    async addCertification(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { productId, certificationType, certificationBody, expiryDate, details } = args;

        const productStr = await this.getProduct(ctx, JSON.stringify({ productId }));
        const product = JSON.parse(productStr);

        // Get deterministic timestamp
        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTimestamp.seconds.low * 1000).toISOString();

        // Verify ownership (simplified for testing)
        const callerId = this.getUserId(ctx);
        if (product.currentOwner !== callerId && callerId !== 'system') {
            console.log('Warning: Ownership check bypassed for testing');
        }

        const certification = {
            type: certificationType,
            certificationBody: certificationBody,
            issuedDate: timestamp,
            expiryDate: expiryDate,
            details: details
        };

        product.certifications.push(certification);
        
        product.history.push({
            action: 'CERTIFICATION_ADDED',
            timestamp: timestamp,
            actor: callerId,
            details: certification
        });

        await ctx.stub.putState(productId, Buffer.from(JSON.stringify(product)));

        return JSON.stringify({ success: true, message: 'Certification added successfully' });
    }

    // Query functions

    // Get product by ID
    async getProduct(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { productId } = args;

        const productBytes = await ctx.stub.getState(productId);
        
        if (!productBytes || productBytes.length === 0) {
            throw new Error(`Product ${productId} does not exist`);
        }
        
        return productBytes.toString();
    }

    // Get product history
    async getProductHistory(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { productId } = args;

        const iterator = await ctx.stub.getHistoryForKey(productId);
        const history = [];

        try {
            while (true) {
                const result = await iterator.next();
                
                if (result.value && result.value.value.toString()) {
                    const record = {
                        txId: result.value.txId,
                        timestamp: result.value.timestamp,
                        isDelete: result.value.is_delete,
                        value: JSON.parse(result.value.value.toString())
                    };
                    history.push(record);
                }
                
                if (result.done) {
                    await iterator.close();
                    break;
                }
            }
        } catch (err) {
            console.error(`Error getting history: ${err}`);
        }

        return JSON.stringify(history);
    }

    // Get all products
    async getAllProducts(ctx) {
        const iterator = await ctx.stub.getStateByRange('PROD', 'PROD~');
        const products = [];

        try {
            while (true) {
                const result = await iterator.next();
                
                if (result.value && result.value.value.toString()) {
                    try {
                        const product = JSON.parse(result.value.value.toString());
                        // Only add if it's actually a product (has productId field)
                        if (product.productId) {
                            products.push(product);
                        }
                    } catch (e) {
                        // Skip non-JSON entries or composite keys
                        continue;
                    }
                }
                
                if (result.done) {
                    await iterator.close();
                    break;
                }
            }
        } catch (err) {
            console.error(`Error getting all products: ${err}`);
        }

        return JSON.stringify(products);
    }

    // Get products by owner using composite keys (LevelDB compatible)
    async getProductsByOwner(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { ownerId } = args;

        console.log(`[getProductsByOwner] Fetching products for owner: ${ownerId}`);

        const iterator = await ctx.stub.getStateByPartialCompositeKey('owner~product', [ownerId]);
        const products = [];

        try {
            while (true) {
                const result = await iterator.next();

                if (result.done) {
                    await iterator.close();
                    console.log(`[getProductsByOwner] Found ${products.length} products for owner ${ownerId}`);
                    break;
                }

                if (result.value && result.value.key) {
                    try {
                        // Extract productId from composite key
                        const compositeKey = ctx.stub.splitCompositeKey(result.value.key);
                        const productId = compositeKey.attributes[1];

                        console.log(`[getProductsByOwner] Found product ID: ${productId}`);

                        // Get the actual product
                        const productBytes = await ctx.stub.getState(productId);
                        if (productBytes && productBytes.length > 0) {
                            const product = JSON.parse(productBytes.toString());
                            products.push(product);
                        }
                    } catch (e) {
                        console.error(`[getProductsByOwner] Error parsing product: ${e.message}`);
                        continue;
                    }
                }
            }
        } catch (err) {
            console.error(`[getProductsByOwner] Error: ${err}`);
            throw new Error(`Failed to get products by owner: ${err.message}`);
        }

        return JSON.stringify(products);
    }

    // Get products by status using composite keys
    async getProductsByStatus(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { status } = args;

        console.log(`[getProductsByStatus] Fetching products with status: ${status}`);

        const iterator = await ctx.stub.getStateByPartialCompositeKey('status~product', [status]);
        const products = [];

        try {
            while (true) {
                const result = await iterator.next();

                if (result.done) {
                    await iterator.close();
                    console.log(`[getProductsByStatus] Found ${products.length} products with status ${status}`);
                    break;
                }

                if (result.value && result.value.key) {
                    try {
                        // Extract productId from composite key
                        const compositeKey = ctx.stub.splitCompositeKey(result.value.key);
                        const productId = compositeKey.attributes[1];

                        // Get the actual product
                        const productBytes = await ctx.stub.getState(productId);
                        if (productBytes && productBytes.length > 0) {
                            const product = JSON.parse(productBytes.toString());
                            products.push(product);
                        }
                    } catch (e) {
                        console.error(`[getProductsByStatus] Error parsing product: ${e.message}`);
                        continue;
                    }
                }
            }
        } catch (err) {
            console.error(`[getProductsByStatus] Error: ${err}`);
            throw new Error(`Failed to get products by status: ${err.message}`);
        }

        return JSON.stringify(products);
    }

    // Get products by type using composite keys
    async getProductsByType(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { productType } = args;

        console.log(`[getProductsByType] Fetching products of type: ${productType}`);

        const iterator = await ctx.stub.getStateByPartialCompositeKey('type~product', [productType]);
        const products = [];

        try {
            while (true) {
                const result = await iterator.next();

                if (result.done) {
                    await iterator.close();
                    console.log(`[getProductsByType] Found ${products.length} products of type ${productType}`);
                    break;
                }

                if (result.value && result.value.key) {
                    try {
                        // Extract productId from composite key
                        const compositeKey = ctx.stub.splitCompositeKey(result.value.key);
                        const productId = compositeKey.attributes[1];

                        // Get the actual product
                        const productBytes = await ctx.stub.getState(productId);
                        if (productBytes && productBytes.length > 0) {
                            const product = JSON.parse(productBytes.toString());
                            products.push(product);
                        }
                    } catch (e) {
                        console.error(`[getProductsByType] Error parsing product: ${e.message}`);
                        continue;
                    }
                }
            }
        } catch (err) {
            console.error(`[getProductsByType] Error: ${err}`);
            throw new Error(`Failed to get products by type: ${err.message}`);
        }

        return JSON.stringify(products);
    }

    // Get products by location using composite keys
    async getProductsByLocation(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { location } = args;

        console.log(`[getProductsByLocation] Fetching products at location: ${location}`);

        const iterator = await ctx.stub.getStateByPartialCompositeKey('location~product', [location]);
        const products = [];

        try {
            while (true) {
                const result = await iterator.next();

                if (result.done) {
                    await iterator.close();
                    console.log(`[getProductsByLocation] Found ${products.length} products at location ${location}`);
                    break;
                }

                if (result.value && result.value.key) {
                    try {
                        // Extract productId from composite key
                        const compositeKey = ctx.stub.splitCompositeKey(result.value.key);
                        const productId = compositeKey.attributes[1];

                        // Get the actual product
                        const productBytes = await ctx.stub.getState(productId);
                        if (productBytes && productBytes.length > 0) {
                            const product = JSON.parse(productBytes.toString());
                            products.push(product);
                        }
                    } catch (e) {
                        console.error(`[getProductsByLocation] Error parsing product: ${e.message}`);
                        continue;
                    }
                }
            }
        } catch (err) {
            console.error(`[getProductsByLocation] Error: ${err}`);
            throw new Error(`Failed to get products by location: ${err.message}`);
        }

        return JSON.stringify(products);
    }

    // Create participant
    async createParticipant(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        
        // Get deterministic timestamp
        const txTimestamp = ctx.stub.getTxTimestamp();
        const timestamp = new Date(txTimestamp.seconds.low * 1000).toISOString();
        
        const participant = {
            participantId: args.participantId,
            role: args.role,
            organizationName: args.organizationName,
            location: args.location,
            contact: args.contact || '',
            registeredDate: args.registeredDate || timestamp,
            status: args.status || 'ACTIVE'
        };

        await ctx.stub.putState(`participant_${args.participantId}`, 
            Buffer.from(JSON.stringify(participant)));
        
        // Create composite key for role-based queries
        const roleIndexKey = await ctx.stub.createCompositeKey('role~participant', 
            [participant.role, participant.participantId]);
        await ctx.stub.putState(roleIndexKey, Buffer.from('\u0000'));
        
        return JSON.stringify({ success: true, participantId: args.participantId });
    }

    // Get participant
    async getParticipant(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { participantId } = args;

        const participantBytes = await ctx.stub.getState(`participant_${participantId}`);
        
        if (!participantBytes || participantBytes.length === 0) {
            throw new Error(`Participant ${participantId} does not exist`);
        }
        
        return participantBytes.toString();
    }

    // Get participants by role using composite keys
    async getParticipantsByRole(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { role } = args;

        console.log(`[getParticipantsByRole] Fetching participants with role: ${role}`);

        const iterator = await ctx.stub.getStateByPartialCompositeKey('role~participant', [role]);
        const participants = [];

        try {
            while (true) {
                const result = await iterator.next();

                if (result.done) {
                    await iterator.close();
                    console.log(`[getParticipantsByRole] Found ${participants.length} participants with role ${role}`);
                    break;
                }

                if (result.value && result.value.key) {
                    try {
                        // Extract participantId from composite key
                        const compositeKey = ctx.stub.splitCompositeKey(result.value.key);
                        const participantId = compositeKey.attributes[1];

                        // Get the actual participant
                        const participantBytes = await ctx.stub.getState(`participant_${participantId}`);
                        if (participantBytes && participantBytes.length > 0) {
                            const participant = JSON.parse(participantBytes.toString());
                            participants.push(participant);
                        }
                    } catch (e) {
                        console.error(`[getParticipantsByRole] Error parsing participant: ${e.message}`);
                        continue;
                    }
                }
            }
        } catch (err) {
            console.error(`[getParticipantsByRole] Error: ${err}`);
            throw new Error(`Failed to get participants by role: ${err.message}`);
        }

        return JSON.stringify(participants);
    }

    // Get supply chain analytics (LevelDB compatible)
    async getSupplyChainAnalytics(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { startDate, endDate } = args;

        console.log(`[getSupplyChainAnalytics] Generating analytics from ${startDate} to ${endDate}`);

        const startTime = startDate ? new Date(startDate).getTime() : 0;
        const endTime = endDate ? new Date(endDate).getTime() : Date.now();

        // Initialize analytics data structure
        const analytics = {
            totalProducts: 0,
            productsByStatus: {},
            productsByType: {},
            productsByOwner: {},
            totalTransfers: 0,
            totalLocationUpdates: 0,
            totalCertifications: 0,
            averageTemperature: null,
            averageHumidity: null,
            productsCreatedInPeriod: 0,
            activeOwners: new Set(),
            dateRange: {
                start: startDate,
                end: endDate
            }
        };

        let temperatureSum = 0;
        let temperatureCount = 0;
        let humiditySum = 0;
        let humidityCount = 0;

        // Get all products
        const iterator = await ctx.stub.getStateByRange('PROD', 'PROD~');

        try {
            while (true) {
                const result = await iterator.next();

                if (result.done) {
                    await iterator.close();
                    break;
                }

                if (result.value && result.value.value.toString()) {
                    try {
                        const product = JSON.parse(result.value.value.toString());

                        // Only process if it's actually a product (has productId field)
                        if (!product.productId) {
                            continue;
                        }

                        // Count total products
                        analytics.totalProducts++;

                        // Count by status
                        if (product.status) {
                            analytics.productsByStatus[product.status] =
                                (analytics.productsByStatus[product.status] || 0) + 1;
                        }

                        // Count by type
                        if (product.productType) {
                            analytics.productsByType[product.productType] =
                                (analytics.productsByType[product.productType] || 0) + 1;
                        }

                        // Count by owner
                        if (product.currentOwner) {
                            analytics.productsByOwner[product.currentOwner] =
                                (analytics.productsByOwner[product.currentOwner] || 0) + 1;
                            analytics.activeOwners.add(product.currentOwner);
                        }

                        // Count certifications
                        if (product.certifications && Array.isArray(product.certifications)) {
                            analytics.totalCertifications += product.certifications.length;
                        }

                        // Calculate average temperature and humidity
                        if (product.temperature !== null && product.temperature !== undefined) {
                            temperatureSum += product.temperature;
                            temperatureCount++;
                        }
                        if (product.humidity !== null && product.humidity !== undefined) {
                            humiditySum += product.humidity;
                            humidityCount++;
                        }

                        // Check if product was created in the specified date range
                        if (product.createdAt) {
                            const createdTime = new Date(product.createdAt).getTime();
                            if (createdTime >= startTime && createdTime <= endTime) {
                                analytics.productsCreatedInPeriod++;
                            }
                        }

                        // Analyze history for events within the date range
                        if (product.history && Array.isArray(product.history)) {
                            for (const historyEntry of product.history) {
                                const eventTime = new Date(historyEntry.timestamp).getTime();

                                // Only count events within the date range
                                if (eventTime >= startTime && eventTime <= endTime) {
                                    if (historyEntry.action === 'OWNERSHIP_TRANSFERRED') {
                                        analytics.totalTransfers++;
                                    } else if (historyEntry.action === 'LOCATION_UPDATED') {
                                        analytics.totalLocationUpdates++;
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // Skip non-JSON entries or invalid products
                        console.error(`[getSupplyChainAnalytics] Error parsing product: ${e.message}`);
                        continue;
                    }
                }
            }
        } catch (err) {
            console.error(`[getSupplyChainAnalytics] Error: ${err}`);
            throw new Error(`Failed to generate analytics: ${err.message}`);
        }

        // Calculate averages
        if (temperatureCount > 0) {
            analytics.averageTemperature = (temperatureSum / temperatureCount).toFixed(2);
        }
        if (humidityCount > 0) {
            analytics.averageHumidity = (humiditySum / humidityCount).toFixed(2);
        }

        // Convert Set to count
        analytics.totalActiveOwners = analytics.activeOwners.size;
        delete analytics.activeOwners; // Remove Set before JSON serialization

        console.log(`[getSupplyChainAnalytics] Analytics generated successfully`);

        return JSON.stringify(analytics);
    }

    // Helper functions

    // Extract userID from certificate DN
    getUserId(ctx) {
        try {
            const clientId = ctx.clientIdentity.getID();
            // clientId format: x509::/OU=org1/OU=client/OU=department1/CN=farmer01::/C=US/ST=.../CN=ca...

            // Extract CN (Common Name) which contains the userID
            const cnMatch = clientId.match(/CN=([^/:]+)/);
            if (cnMatch && cnMatch[1]) {
                return cnMatch[1];
            }

            // Fallback to full ID if CN extraction fails
            console.log('Warning: Could not extract CN from client ID, using full ID');
            return clientId;
        } catch (error) {
            console.log('Error extracting user ID:', error.message);
            return 'unknown';
        }
    }

    async getCallerRole(ctx) {
        try {
            // Try to get role from certificate attributes
            const role = ctx.clientIdentity.getAttributeValue('role');
            return role;
        } catch (error) {
            // Fallback: determine role based on MSP ID
            try {
                const mspId = ctx.clientIdentity.getMSPID();
                if (mspId.includes('Org1')) return 'farmer';
                if (mspId.includes('Org2')) return 'distributor';
                return 'unknown';
            } catch (e) {
                console.log('Could not determine role:', e.message);
                return 'unknown';
            }
        }
    }

    // Query with composite keys (replacing CouchDB rich queries)
    async queryWithCompositeKeys(ctx, indexName, attributes) {
        const iterator = await ctx.stub.getStateByPartialCompositeKey(indexName, attributes);
        const results = [];

        try {
            while (true) {
                const result = await iterator.next();
                
                if (result.value) {
                    // The actual data is stored separately, this just gives us the key
                    results.push(result.key);
                }
                
                if (result.done) {
                    await iterator.close();
                    break;
                }
            }
        } catch (err) {
            console.error(`Error in composite key query: ${err}`);
        }

        return results;
    }

    // Advanced query: Get products with multiple criteria
    async queryProductsAdvanced(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { owner, status, productType, location } = args;
        
        let products = [];
        
        // Start with the most selective criteria
        if (owner) {
            const ownerProducts = await this.getProductsByOwner(ctx, JSON.stringify({ ownerId: owner }));
            products = JSON.parse(ownerProducts);
        } else if (status) {
            const statusProducts = await this.getProductsByStatus(ctx, JSON.stringify({ status }));
            products = JSON.parse(statusProducts);
        } else if (productType) {
            const typeProducts = await this.getProductsByType(ctx, JSON.stringify({ productType }));
            products = JSON.parse(typeProducts);
        } else if (location) {
            const locationProducts = await this.getProductsByLocation(ctx, JSON.stringify({ location }));
            products = JSON.parse(locationProducts);
        } else {
            // No criteria specified, return all
            const allProducts = await this.getAllProducts(ctx);
            products = JSON.parse(allProducts);
        }
        
        // Filter by additional criteria if specified
        if (owner && products.length > 0) {
            products = products.filter(p => p.currentOwner === owner);
        }
        if (status && products.length > 0) {
            products = products.filter(p => p.status === status);
        }
        if (productType && products.length > 0) {
            products = products.filter(p => p.productType === productType);
        }
        if (location && products.length > 0) {
            products = products.filter(p => p.location === location);
        }
        
        return JSON.stringify(products);
    }

    // Delete a product (admin function)
    async deleteProduct(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { productId } = args;
        
        // Get the product first to clean up composite keys
        const productStr = await this.getProduct(ctx, JSON.stringify({ productId }));
        const product = JSON.parse(productStr);
        
        // Delete all composite keys
        const ownerIndexKey = await ctx.stub.createCompositeKey('owner~product', 
            [product.currentOwner, productId]);
        await ctx.stub.deleteState(ownerIndexKey);
        
        const statusIndexKey = await ctx.stub.createCompositeKey('status~product', 
            [product.status, productId]);
        await ctx.stub.deleteState(statusIndexKey);
        
        const typeIndexKey = await ctx.stub.createCompositeKey('type~product', 
            [product.productType, productId]);
        await ctx.stub.deleteState(typeIndexKey);
        
        const locationIndexKey = await ctx.stub.createCompositeKey('location~product', 
            [product.location, productId]);
        await ctx.stub.deleteState(locationIndexKey);
        
        // Delete the product
        await ctx.stub.deleteState(productId);
        
        return JSON.stringify({ success: true, message: `Product ${productId} deleted successfully` });
    }
}

module.exports = ProductTrace;
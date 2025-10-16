/*
 * Product Tracing Chaincode
 * This chaincode manages the product lifecycle in the supply chain
 */

'use strict';

const { Contract } = require('fabric-contract-api');

class ProductTraceContract extends Contract {

    // Initialize the ledger with sample data
    async initLedger(ctx) {
        console.log('Initializing ledger with sample data');
        
        const products = [
            {
                productId: 'PROD001',
                productName: 'Organic Tomatoes',
                productType: 'vegetable',
                currentOwner: 'farmer01',
                quantity: 1000,
                unit: 'kg',
                status: 'CREATED',
                location: 'Green Valley Farms, California',
                temperature: null,
                humidity: null,
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
                history: []
            }
        ];

        for (const product of products) {
            await ctx.stub.putState(product.productId, Buffer.from(JSON.stringify(product)));
            console.log(`Added product: ${product.productId}`);
        }
    }

    // Create a new product
    async createProduct(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        
        // Validate caller's role
        const clientMSPID = ctx.clientIdentity.getMSPID();
        const role = await this.getCallerRole(ctx);
        
        if (role !== 'farmer' && role !== 'manufacturer') {
            throw new Error('Only farmers and manufacturers can create products');
        }

        const productId = this.generateProductId();
        
        const product = {
            productId: productId,
            productName: args.productName,
            productType: args.productType,
            currentOwner: ctx.clientIdentity.getID(),
            quantity: args.quantity,
            unit: args.unit || 'kg',
            status: 'CREATED',
            location: args.location,
            temperature: null,
            humidity: null,
            harvestDate: args.harvestDate || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            certifications: args.certifications || [],
            history: [
                {
                    action: 'CREATED',
                    timestamp: new Date().toISOString(),
                    actor: ctx.clientIdentity.getID(),
                    details: `Product created by ${role}`
                }
            ]
        };

        await ctx.stub.putState(productId, Buffer.from(JSON.stringify(product)));
        
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

        // Verify current owner
        if (product.currentOwner !== ctx.clientIdentity.getID()) {
            throw new Error('Only the current owner can transfer ownership');
        }

        // Record transfer in history
        product.history.push({
            action: 'OWNERSHIP_TRANSFERRED',
            timestamp: new Date().toISOString(),
            actor: ctx.clientIdentity.getID(),
            details: {
                from: product.currentOwner,
                to: newOwnerId,
                price: price,
                notes: notes
            }
        });

        // Update ownership
        product.currentOwner = newOwnerId;
        product.status = 'TRANSFERRED';

        await ctx.stub.putState(productId, Buffer.from(JSON.stringify(product)));

        // Emit event
        ctx.stub.setEvent('OwnershipTransferred', Buffer.from(JSON.stringify({
            productId: productId,
            from: ctx.clientIdentity.getID(),
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
            throw new Error('Only shippers and distributors can update location');
        }

        const productStr = await this.getProduct(ctx, JSON.stringify({ productId }));
        const product = JSON.parse(productStr);

        // Update location and environmental data
        product.location = location;
        if (temperature !== undefined) product.temperature = temperature;
        if (humidity !== undefined) product.humidity = humidity;
        product.status = 'IN_TRANSIT';

        // Add to history
        product.history.push({
            action: 'LOCATION_UPDATED',
            timestamp: new Date().toISOString(),
            actor: ctx.clientIdentity.getID(),
            details: {
                location: location,
                temperature: temperature,
                humidity: humidity
            }
        });

        await ctx.stub.putState(productId, Buffer.from(JSON.stringify(product)));

        return JSON.stringify({ success: true, message: 'Location updated successfully' });
    }

    // Process products (for manufacturers)
    async processProduct(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { inputProductIds, outputProductName, outputQuantity, processingDetails } = args;

        const role = await this.getCallerRole(ctx);
        if (role !== 'manufacturer') {
            throw new Error('Only manufacturers can process products');
        }

        // Verify ownership of all input products
        for (const inputId of inputProductIds) {
            const productStr = await this.getProduct(ctx, JSON.stringify({ productId: inputId }));
            const product = JSON.parse(productStr);
            
            if (product.currentOwner !== ctx.clientIdentity.getID()) {
                throw new Error(`You don't own product ${inputId}`);
            }
            
            // Mark input products as processed
            product.status = 'PROCESSED';
            product.history.push({
                action: 'PROCESSED',
                timestamp: new Date().toISOString(),
                actor: ctx.clientIdentity.getID(),
                details: processingDetails
            });
            
            await ctx.stub.putState(inputId, Buffer.from(JSON.stringify(product)));
        }

        // Create new processed product
        const newProductArgs = {
            productName: outputProductName,
            productType: 'processed',
            quantity: outputQuantity,
            unit: 'units',
            location: 'Manufacturing facility',
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

        // Verify ownership or authorized certifier
        if (product.currentOwner !== ctx.clientIdentity.getID()) {
            throw new Error('Only the owner can add certifications');
        }

        const certification = {
            type: certificationType,
            certificationBody: certificationBody,
            issuedDate: new Date().toISOString(),
            expiryDate: expiryDate,
            details: details
        };

        product.certifications.push(certification);
        
        product.history.push({
            action: 'CERTIFICATION_ADDED',
            timestamp: new Date().toISOString(),
            actor: ctx.clientIdentity.getID(),
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
        const iterator = await ctx.stub.getStateByRange('', '');
        const products = [];

        try {
            while (true) {
                const result = await iterator.next();
                
                if (result.value && result.value.value.toString()) {
                    const product = JSON.parse(result.value.value.toString());
                    products.push(product);
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

    // Get products by owner
    async getProductsByOwner(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        const { ownerId } = args;

        const queryString = {
            selector: {
                currentOwner: ownerId
            }
        };

        return await this.queryWithQueryString(ctx, JSON.stringify(queryString));
    }

    // Helper functions

    async getCallerRole(ctx) {
        // Extract role from certificate attributes
        // This is a simplified version
        return ctx.clientIdentity.getAttributeValue('role');
    }

    generateProductId() {
        return 'PROD' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
    }

    async queryWithQueryString(ctx, queryString) {
        const query = JSON.parse(queryString);
        const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
        const results = [];

        try {
            while (true) {
                const result = await iterator.next();
                
                if (result.value && result.value.value.toString()) {
                    results.push(JSON.parse(result.value.value.toString()));
                }
                
                if (result.done) {
                    await iterator.close();
                    break;
                }
            }
        } catch (err) {
            console.error(`Error in query: ${err}`);
        }

        return JSON.stringify(results);
    }

    // Create participant
    async createParticipant(ctx, argsStr) {
        const args = JSON.parse(argsStr);
        
        const participant = {
            participantId: args.participantId,
            role: args.role,
            organizationName: args.organizationName,
            location: args.location,
            contact: args.contact || '',
            registeredDate: args.registeredDate,
            status: args.status
        };

        await ctx.stub.putState(`participant_${args.participantId}`, Buffer.from(JSON.stringify(participant)));
        
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
}

module.exports = ProductTraceContract;
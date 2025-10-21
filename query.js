'use strict';

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

const getQuery = async (fcn, args, userId) => {
    console.log('\nget query ',fcn, args, userID)
    let gateway;
    try {
        // Get wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Special handling for public queries
        if (userId === 'publicUser') {
            // Create a temporary public user identity if needed
            // In production, you'd have a dedicated public query user
            userId = 'publicQueryUser';
        }

        // Check user identity
        const identity = await wallet.get(userId);
        if (!identity) {
            return {
                statusCode: 404,
                success: false,
                message: `User ${userId} not found in wallet`
            };
        }

        // Determine organization
        const orgID = identity.mspId === 'Org1MSP' ? 'Org1' : 'Org2';
        
        // Load connection profile
        const ccpPath = path.resolve(
            __dirname,
            '..',
            'fabric-samples',
            'test-network',
            'organizations',
            'peerOrganizations',
            `${orgID}.example.com`.toLowerCase(),
            `connection-${orgID}.json`.toLowerCase()
        );
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Connect to gateway
        gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: userId,
            discovery: { enabled: true, asLocalhost: true }
        });

        // Get network and contract
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('productTrace');

        console.log(`Executing query: ${fcn} with args:`, args);
        console.log('contract', contract)
        // Execute query based on function name
        let result;
        const argsString = JSON.stringify(args);

        switch (fcn) {
            case 'getProduct':
                result = await contract.evaluateTransaction('getProduct', argsString);
                break;

            case 'getProductHistory':
                result = await contract.evaluateTransaction('getProductHistory', argsString);
                break;

            case 'getProductsByOwner':
                result = await contract.evaluateTransaction('getProductsByOwner', argsString);
                break;

            case 'getProductsByStatus':
                result = await contract.evaluateTransaction('getProductsByStatus', argsString);
                break;

            case 'getAllProducts':
                result = await contract.evaluateTransaction('getAllProducts');
                break;

            case 'getParticipant':
                result = await contract.evaluateTransaction('getParticipant', argsString);
                break;

            case 'getSupplyChainAnalytics':
                result = await contract.evaluateTransaction('getSupplyChainAnalytics', argsString);
                break;

            case 'verifyProduct':
                result = await contract.evaluateTransaction('verifyProduct', argsString);
                break;

            case 'getShipment':
                result = await contract.evaluateTransaction('getShipment', argsString);
                break;

            case 'getProductsByDateRange':
                result = await contract.evaluateTransaction('getProductsByDateRange', argsString);
                break;

            case 'getCertificationsByProduct':
                result = await contract.evaluateTransaction('getCertificationsByProduct', argsString);
                break;

            case 'getLocationHistory':
                result = await contract.evaluateTransaction('getLocationHistory', argsString);
                break;

            case 'getTemperatureHistory':
                result = await contract.evaluateTransaction('getTemperatureHistory', argsString);
                break;

            case 'getProductLineage':
                result = await contract.evaluateTransaction('getProductLineage', argsString);
                break;

            case 'searchProducts':
                result = await contract.evaluateTransaction('searchProducts', argsString);
                break;

            default:
                // Generic query execution
                result = await contract.evaluateTransaction(fcn, argsString);
        }

        // Parse result
        let parsedResult;
        try {
            parsedResult = JSON.parse(result.toString());
        } catch (e) {
            parsedResult = result.toString();
        }

        console.log(`Query ${fcn} executed successfully`);

        return {
            statusCode: 200,
            success: true,
            data: parsedResult
        };

    } catch (error) {
        console.error(`Failed to execute query ${fcn}:`, error);
        return {
            statusCode: 500,
            success: false,
            message: error.message,
            error: error.toString()
        };
    } finally {
        // Disconnect from gateway
        if (gateway) {
            try {
                await gateway.disconnect();
            } catch (err) {
                console.error('Error disconnecting from gateway:', err);
            }
        }
    }
};

// Rich query with pagination
const getRichQuery = async (queryString, pageSize, bookmark, userId) => {
    let gateway;
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const identity = await wallet.get(userId);
        if (!identity) {
            throw new Error(`User ${userId} not found`);
        }

        const orgID = identity.mspId === 'Org1MSP' ? 'Org1' : 'Org2';
        const ccpPath = path.resolve(
            __dirname,
            '..',
            'fabric-samples',
            'test-network',
            'organizations',
            'peerOrganizations',
            `${orgID}.example.com`.toLowerCase(),
            `connection-${orgID}.json`.toLowerCase()
        );
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: userId,
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('productTrace');

        const args = {
            queryString,
            pageSize: pageSize || 10,
            bookmark: bookmark || ''
        };

        const result = await contract.evaluateTransaction('queryWithPagination', JSON.stringify(args));
        const parsedResult = JSON.parse(result.toString());

        return {
            statusCode: 200,
            success: true,
            data: parsedResult.records,
            metadata: {
                recordsCount: parsedResult.records.length,
                fetchedRecordsCount: parsedResult.fetchedRecordsCount,
                bookmark: parsedResult.bookmark
            }
        };

    } catch (error) {
        console.error('Rich query failed:', error);
        return {
            statusCode: 500,
            success: false,
            message: error.message
        };
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
};

// Query for getting aggregated statistics
const getAggregatedStats = async (statsType, userId) => {
    let gateway;
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const identity = await wallet.get(userId);
        if (!identity) {
            throw new Error(`User ${userId} not found`);
        }

        const orgID = identity.mspId === 'Org1MSP' ? 'Org1' : 'Org2';
        const ccpPath = path.resolve(
            __dirname,
            '..',
            'fabric-samples',
            'test-network',
            'organizations',
            'peerOrganizations',
            `${orgID}.example.com`.toLowerCase(),
            `connection-${orgID}.json`.toLowerCase()
        );
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: userId,
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('productTrace');

        let result;
        switch (statsType) {
            case 'productCount':
                result = await contract.evaluateTransaction('getProductCount');
                break;
            case 'participantCount':
                result = await contract.evaluateTransaction('getParticipantCount');
                break;
            case 'transactionVolume':
                result = await contract.evaluateTransaction('getTransactionVolume');
                break;
            case 'supplyChainEfficiency':
                result = await contract.evaluateTransaction('getSupplyChainEfficiency');
                break;
            default:
                result = await contract.evaluateTransaction('getGeneralStats');
        }

        return {
            statusCode: 200,
            success: true,
            statsType: statsType,
            data: JSON.parse(result.toString())
        };

    } catch (error) {
        console.error('Failed to get aggregated stats:', error);
        return {
            statusCode: 500,
            success: false,
            message: error.message
        };
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
};

module.exports = {
    getQuery,
    getRichQuery,
    getAggregatedStats
};
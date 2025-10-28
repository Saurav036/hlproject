'use strict';

const fs = require('fs');
const path = require('path');
const { Wallets, Gateway } = require('fabric-network');

const invokeTransaction = async (fcn, args, userID) => {
    console.log('\nInvoke tranx',fcn, args, userID)
    let gateway;
    try {
        // Get wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check user identity
        const identity = await wallet.get(userID);
        if (!identity) {
            return {
                statusCode: 404,
                success: false,
                message: `User ${userID} not found in wallet`
            };
        }

        // Determine organization from MSP ID
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
            identity: userID,
            discovery: { enabled: true, asLocalhost: true }
        });

        // Get network and contract
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('productTrace');

        console.log(`Invoking transaction: ${fcn} with args:`, args);
        // console.log(contract)
        // Submit transaction
        let result;
        const argsString = JSON.stringify(args);
        
        switch (fcn) {
            case 'createProduct':
                result = await contract.submitTransaction('createProduct', argsString);
                break;
            
            case 'updateLocation':
                result = await contract.submitTransaction('updateLocation', argsString);
                break;
            
            case 'transferOwnership':
                result = await contract.submitTransaction('transferOwnership', argsString);
                break;
            
            case 'processProduct':
                result = await contract.submitTransaction('processProduct', argsString);
                break;
            
            case 'addCertification':
                result = await contract.submitTransaction('addCertification', argsString);
                break;
            
            case 'updateProductStatus':
                result = await contract.submitTransaction('updateProductStatus', argsString);
                break;
            
            case 'addTemperatureReading':
                result = await contract.submitTransaction('addTemperatureReading', argsString);
                break;
            
            case 'reportQualityIssue':
                result = await contract.submitTransaction('reportQualityIssue', argsString);
                break;
            
            case 'createShipment':
                result = await contract.submitTransaction('createShipment', argsString);
                break;
            
            case 'updateShipmentStatus':
                result = await contract.submitTransaction('updateShipmentStatus', argsString);
                break;
            
            case 'completeDelivery':
                result = await contract.submitTransaction('completeDelivery', argsString);
                break;
            
            default:
                // Generic transaction invocation
                result = await contract.submitTransaction(fcn, argsString);
        }

        // Parse result
        let parsedResult;
        try {
            parsedResult = JSON.parse(result.toString());
        } catch (e) {
            parsedResult = result.toString();
        }

        console.log(`Transaction ${fcn} completed successfully`);

        return {
            statusCode: 200,
            success: true,
            transactionId: result.toString() ? 'TX_' + Date.now() : undefined,
            data: parsedResult,
            message: `Transaction ${fcn} completed successfully`
        };

    } catch (error) {
        console.error(`Failed to invoke transaction ${fcn}:`, error);
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

// Batch transaction submission for efficiency
const invokeBatchTransaction = async (transactions, userID) => {
    console.log('\nInvoke batch tranx',transactions, userID)
    let gateway;
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const identity = await wallet.get(userID);
        if (!identity) {
            throw new Error(`User ${userID} not found`);
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
            identity: userID,
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('productTrace');

        const results = [];
        
        for (const tx of transactions) {
            try {
                const result = await contract.submitTransaction(
                    tx.function,
                    JSON.stringify(tx.args)
                );
                results.push({
                    function: tx.function,
                    success: true,
                    result: JSON.parse(result.toString())
                });
            } catch (error) {
                results.push({
                    function: tx.function,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            statusCode: 200,
            success: true,
            results: results
        };

    } catch (error) {
        console.error('Batch transaction failed:', error);
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
    invokeTransaction,
    invokeBatchTransaction
};
'use strict';

const fs = require('fs');
const path = require('path');
const FabricCAServices = require('fabric-ca-client');
const { Wallets, Gateway } = require('fabric-network');

const registerUser = async (adminID, userID, userRole, additionalInfo) => {
    try {
        // Determine organization based on role
        let orgID, orgMSP, adminRole;
        switch (userRole) {
            case 'farmer':
                orgID = 'Org1';
                orgMSP = 'Org1MSP';
                adminRole = 'farmerAdmin';
                break;
            case 'manufacturer':
            case 'distributor':
            case 'retailer':
                orgID = 'Org2';
                orgMSP = 'Org2MSP';
                adminRole = 'manufacturerAdmin';
                break;
            case 'shipper':
                orgID = 'Org1'; // Can be adjusted based on network design
                orgMSP = 'Org1MSP';
                adminRole = 'farmerAdmin';
                break;
            default:
                throw new Error(`Invalid role: ${userRole}`);
        }

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

        // Create a new CA client
        const caOrg = ccp.organizations[orgID].certificateAuthorities[0];
        const caURL = ccp.certificateAuthorities[caOrg].url;
        const ca = new FabricCAServices(caURL);

        // Create wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check if user already exists
        const userIdentity = await wallet.get(userID);
        if (userIdentity) {
            console.log(`Identity for user ${userID} already exists`);
            return {
                statusCode: 200,
                success: true,
                message: `${userID} already enrolled`,
                userID: userID,
                role: userRole
            };
        }

        // Check admin identity
        const adminIdentity = await wallet.get(adminID);
        if (!adminIdentity) {
            throw new Error(`Admin user ${adminID} does not exist. Run initialization first.`);
        }

        // Build admin user object
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, adminID);

        // Register the user with CA
        const secret = await ca.register({
            affiliation: `${orgID}.department1`.toLowerCase(),
            enrollmentID: userID,
            role: 'client',
            attrs: [
                { name: 'role', value: userRole, ecert: true },
                { name: 'uuid', value: userID, ecert: true },
                { name: 'organizationName', value: additionalInfo.organizationName || '', ecert: true },
                { name: 'location', value: additionalInfo.location || '', ecert: true }
            ]
        }, adminUser);

        // Enroll the user
        const enrollment = await ca.enroll({
            enrollmentID: userID,
            enrollmentSecret: secret,
            attr_reqs: [
                { name: 'role', optional: false },
                { name: 'uuid', optional: false },
                { name: 'organizationName', optional: true },
                { name: 'location', optional: true }
            ]
        });

        // Create X.509 identity
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: orgMSP,
            type: 'X.509',
        };

        // Store identity in wallet
        await wallet.put(userID, x509Identity);
        console.log(`Successfully registered and enrolled user ${userID}`);

        // Create participant on the blockchain
        const gateway = new Gateway();
        await gateway.connect(ccp, { 
            wallet, 
            identity: adminID, 
            discovery: { enabled: true, asLocalhost: true } 
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('productTrace');

        const participantData = {
            participantId: userID,
            role: userRole,
            organizationName: additionalInfo.organizationName || `${userRole}-${userID}`,
            location: additionalInfo.location || 'Not specified',
            contact: additionalInfo.contact || '',
            registeredDate: new Date().toISOString(),
            status: 'ACTIVE'
        };

        const buffer = await contract.submitTransaction('createParticipant', JSON.stringify(participantData));
        
        // Disconnect from gateway
        await gateway.disconnect();

        return {
            statusCode: 200,
            success: true,
            userID: userID,
            role: userRole,
            message: `${userID} registered successfully`,
            blockchainResponse: buffer.toString()
        };

    } catch (error) {
        console.error(`Failed to register user ${userID}:`, error);
        return {
            statusCode: 500,
            success: false,
            message: error.message
        };
    }
};

const login = async (userID) => {
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const identity = await wallet.get(userID);
        if (!identity) {
            return {
                statusCode: 404,
                success: false,
                message: `User ${userID} not found. Please register first.`
            };
        }

        // Get user details from the blockchain
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

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: userID,
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('productTrace');

        // Get participant details from blockchain
        const participantBuffer = await contract.evaluateTransaction('getParticipant', JSON.stringify({ participantId: userID }));
        const participant = JSON.parse(participantBuffer.toString());

        await gateway.disconnect();

        return {
            statusCode: 200,
            success: true,
            userID: userID,
            participant: participant,
            message: 'Login successful'
        };

    } catch (error) {
        console.error(`Login failed for user ${userID}:`, error);
        return {
            statusCode: 500,
            success: false,
            message: error.message
        };
    }
};

const checkUserRole = async (userID) => {
    try {
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        const identity = await wallet.get(userID);
        if (!identity) {
            throw new Error(`User ${userID} not found`);
        }

        // Parse the certificate to extract attributes
        const certificate = identity.credentials.certificate;
        // Extract role from certificate attributes
        // This is a simplified version - actual implementation would parse X.509 certificate
        
        return {
            success: true,
            userID: userID,
            mspId: identity.mspId
        };

    } catch (error) {
        console.error(`Error checking user role:`, error);
        throw error;
    }
};

module.exports = {
    registerUser,
    login,
    checkUserRole
};
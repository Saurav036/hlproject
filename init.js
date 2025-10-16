#!/usr/bin/env node
'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// Initialize all organizations and create sample participants
async function main() {
    console.log('🚀 Initializing Product Tracing Network...\n');
    
    try {
        // Step 1: Initialize Farmer Organization (Org1)
        console.log('📦 Step 1: Setting up Farmer Organization...');
        await initOrganization('Org1', 'farmerAdmin');
        console.log('✅ Farmer Organization initialized\n');

        // Step 2: Initialize Manufacturer/Retailer Organization (Org2)
        console.log('📦 Step 2: Setting up Manufacturer Organization...');
        await initOrganization('Org2', 'manufacturerAdmin');
        console.log('✅ Manufacturer Organization initialized\n');

        // Step 3: Create sample participants
        console.log('👥 Step 3: Creating sample participants...');
        await createSampleParticipants();
        console.log('✅ Sample participants created\n');

        // Step 4: Deploy and initialize chaincode
        console.log('📜 Step 4: Initializing chaincode...');
        await initChaincode();
        console.log('✅ Chaincode initialized\n');

        console.log('🎉 Network initialization complete!');
        console.log('\nYou can now start the server with: npm start');
        
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        process.exit(1);
    }
}

async function initOrganization(orgName, adminName) {
    const ccpPath = path.resolve(
        __dirname,
        '../..',
        'fabric-samples',
        'test-network',
        'organizations',
        'peerOrganizations',
        `${orgName}.example.com`.toLowerCase(),
        `connection-${orgName}.json`.toLowerCase()
    );
    
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const caInfo = ccp.certificateAuthorities[`ca.${orgName}.example.com`.toLowerCase()];
    const caTLSCACerts = caInfo.tlsCACerts.pem;
    const ca = new FabricCAServices(caInfo.url, { 
        trustedRoots: caTLSCACerts, 
        verify: false 
    }, caInfo.caName);

    const walletPath = path.join(process.cwd(), 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    // Check if admin already exists
    const identity = await wallet.get(adminName);
    if (identity) {
        console.log(`  ⚠️  Admin ${adminName} already exists`);
        return;
    }

    // Enroll admin
    const enrollment = await ca.enroll({ 
        enrollmentID: 'admin', 
        enrollmentSecret: 'adminpw' 
    });
    
    const x509Identity = {
        credentials: {
            certificate: enrollment.certificate,
            privateKey: enrollment.key.toBytes(),
        },
        mspId: `${orgName}MSP`,
        type: 'X.509',
    };
    
    await wallet.put(adminName, x509Identity);
    console.log(`  ✅ Admin ${adminName} enrolled successfully`);
}

async function createSampleParticipants() {
    const participants = [
        {
            id: 'farmer01',
            role: 'farmer',
            admin: 'farmerAdmin',
            org: 'Org1',
            name: 'Green Valley Farms',
            location: 'California, USA'
        },
        {
            id: 'farmer02',
            role: 'farmer',
            admin: 'farmerAdmin',
            org: 'Org1',
            name: 'Organic Harvest Co',
            location: 'Oregon, USA'
        },
        {
            id: 'manufacturer01',
            role: 'manufacturer',
            admin: 'manufacturerAdmin',
            org: 'Org2',
            name: 'Fresh Foods Processing',
            location: 'Texas, USA'
        },
        {
            id: 'distributor01',
            role: 'distributor',
            admin: 'manufacturerAdmin',
            org: 'Org2',
            name: 'Global Distribution Network',
            location: 'New York, USA'
        },
        {
            id: 'retailer01',
            role: 'retailer',
            admin: 'manufacturerAdmin',
            org: 'Org2',
            name: 'SuperMart Chain',
            location: 'Illinois, USA'
        },
        {
            id: 'shipper01',
            role: 'shipper',
            admin: 'farmerAdmin',
            org: 'Org1',
            name: 'Quick Logistics',
            location: 'Georgia, USA'
        }
    ];

    for (const participant of participants) {
        await registerParticipant(participant);
    }
}

async function registerParticipant(participant) {
    try {
        const ccpPath = path.resolve(
            __dirname,
            '../..',
            'fabric-samples',
            'test-network',
            'organizations',
            'peerOrganizations',
            `${participant.org}.example.com`.toLowerCase(),
            `connection-${participant.org}.json`.toLowerCase()
        );
        
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const caURL = ccp.certificateAuthorities[`ca.${participant.org}.example.com`.toLowerCase()].url;
        const ca = new FabricCAServices(caURL);

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check if participant already exists
        const userIdentity = await wallet.get(participant.id);
        if (userIdentity) {
            console.log(`  ⚠️  ${participant.id} already exists`);
            return;
        }

        // Get admin identity
        const adminIdentity = await wallet.get(participant.admin);
        if (!adminIdentity) {
            throw new Error(`Admin ${participant.admin} not found`);
        }

        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, participant.admin);

        // Register participant
        const secret = await ca.register({
            affiliation: `${participant.org}.department1`.toLowerCase(),
            enrollmentID: participant.id,
            role: 'client',
            attrs: [
                { name: 'role', value: participant.role, ecert: true },
                { name: 'organizationName', value: participant.name, ecert: true },
                { name: 'location', value: participant.location, ecert: true }
            ]
        }, adminUser);

        // Enroll participant
        const enrollment = await ca.enroll({
            enrollmentID: participant.id,
            enrollmentSecret: secret,
            attr_reqs: [
                { name: 'role', optional: false },
                { name: 'organizationName', optional: false },
                { name: 'location', optional: false }
            ]
        });

        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: `${participant.org}MSP`,
            type: 'X.509',
        };

        await wallet.put(participant.id, x509Identity);
        console.log(`  ✅ ${participant.id} (${participant.name}) registered`);

        // Initialize participant on blockchain
        await initParticipantOnBlockchain(participant, ccp, wallet);

    } catch (error) {
        console.error(`  ❌ Failed to register ${participant.id}:`, error.message);
    }
}

async function initParticipantOnBlockchain(participant, ccp, wallet) {
    let gateway;
    try {
        gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: participant.admin,
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('productTrace');

        const participantData = {
            participantId: participant.id,
            role: participant.role,
            organizationName: participant.name,
            location: participant.location,
            registeredDate: new Date().toISOString(),
            status: 'ACTIVE'
        };

        await contract.submitTransaction('createParticipant', JSON.stringify(participantData));
        
    } catch (error) {
        console.log(`  ⚠️  Chaincode initialization pending for ${participant.id}`);
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
}

async function initChaincode() {
    let gateway;
    try {
        const ccpPath = path.resolve(
            __dirname,
            '../..',
            'fabric-samples',
            'test-network',
            'organizations',
            'peerOrganizations',
            'org1.example.com',
            'connection-org1.json'
        );
        
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'farmerAdmin',
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('productTrace');

        // Initialize ledger with sample data
        await contract.submitTransaction('initLedger');
        console.log('  ✅ Ledger initialized with sample data');

    } catch (error) {
        console.log('  ⚠️  Chaincode initialization skipped (may already be initialized)');
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
}

// Run the initialization
main();
#!/usr/bin/env node
'use strict';

/**
 * Register Participants in the Supply Chain Network
 * This script registers various participants (farmers, manufacturers, etc.)
 */

const FabricCAServices = require('fabric-ca-client');
const { Wallets, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Default participants to register
const DEFAULT_PARTICIPANTS = [
    {
        id: 'sysadmin',
        role: 'admin',
        admin: 'farmerAdmin',
        org: 'Org1',
        details: {
            name: 'WyldTrace Admin',
            location: 'Headquarters',
            contact: 'admin@wyldtrace.com',
            description: 'System administrator with full access'
        }
    },
    {
        id: 'farmer01',
        role: 'farmer',
        admin: 'farmerAdmin',
        org: 'Org1',
        details: {
            name: 'Green Valley Farms',
            location: 'California, USA',
            contact: 'contact@greenvalley.com',
            description: 'Organic vegetable farm specializing in tomatoes and lettuce'
        }
    },
    {
        id: 'farmer02',
        role: 'farmer',
        admin: 'farmerAdmin',
        org: 'Org1',
        details: {
            name: 'Sunny Fields Farm',
            location: 'Iowa, USA',
            contact: 'contact@sunnyfields.com',
            description: 'Grain producer specializing in wheat and corn'
        }
    },
    {
        id: 'farmer03',
        role: 'farmer',
        admin: 'farmerAdmin',
        org: 'Org1',
        details: {
            name: 'Fresh Greens Co',
            location: 'Oregon, USA',
            contact: 'info@freshgreens.com',
            description: 'Lettuce and leafy greens producer'
        }
    },
    {
        id: 'manufacturer01',
        role: 'manufacturer',
        admin: 'manufacturerAdmin',
        org: 'Org2',
        details: {
            name: 'Food Processing Inc',
            location: 'California, USA',
            contact: 'contact@foodprocessing.com',
            description: 'Food processing and packaging facility'
        }
    },
    {
        id: 'manufacturer02',
        role: 'manufacturer',
        admin: 'manufacturerAdmin',
        org: 'Org2',
        details: {
            name: 'Organic Preserves Co',
            location: 'Vermont, USA',
            contact: 'info@organicpreserves.com',
            description: 'Specialty jams, sauces, and preserved foods'
        }
    },
    {
        id: 'distributor01',
        role: 'distributor',
        admin: 'manufacturerAdmin',
        org: 'Org2',
        details: {
            name: 'Fast Distribution Co',
            location: 'Texas, USA',
            contact: 'info@fastdist.com',
            description: 'International food distribution network'
        }
    },
    {
        id: 'retailer01',
        role: 'retailer',
        admin: 'manufacturerAdmin',
        org: 'Org2',
        details: {
            name: 'Fresh Market Store',
            location: 'New York, USA',
            contact: 'sales@freshmarket.com',
            description: 'Retail supermarket chain'
        }
    },
    {
        id: 'retailer02',
        role: 'retailer',
        admin: 'manufacturerAdmin',
        org: 'Org2',
        details: {
            name: 'Organic Corner Store',
            location: 'San Francisco, USA',
            contact: 'hello@organiccorner.com',
            description: 'Boutique organic food retailer'
        }
    },
    {
        id: 'shipper01',
        role: 'shipper',
        admin: 'farmerAdmin',
        org: 'Org1',
        details: {
            name: 'ColdChain Logistics',
            location: 'Atlanta, USA',
            contact: 'dispatch@coldchain.com',
            description: 'Temperature-controlled transportation services'
        }
    },
    {
        id: 'shipper02',
        role: 'shipper',
        admin: 'farmerAdmin',
        org: 'Org1',
        details: {
            name: 'Express Freight Services',
            location: 'Memphis, USA',
            contact: 'tracking@expressfreight.com',
            description: 'Fast and reliable shipping solutions'
        }
    }
];

// Register a single participant
async function registerParticipant(participant, verbose = true) {
    try {
        if (verbose) {
            console.log(`${colors.cyan}Registering ${participant.role}: ${participant.id}${colors.reset}`);
        }

        // Load connection profile
        const ccpPath = path.resolve(
            __dirname,
            '..',
            'fabric-samples',
            'test-network',
            'organizations',
            'peerOrganizations',
            `${participant.org}.example.com`.toLowerCase(),
            `connection-${participant.org}.json`.toLowerCase()
        );

        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Connection profile not found at ${ccpPath}`);
        }

        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const caURL = ccp.certificateAuthorities[`ca.${participant.org}.example.com`.toLowerCase()].url;
        const ca = new FabricCAServices(caURL);

        // Get wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check if participant already exists
        const userIdentity = await wallet.get(participant.id);
        if (userIdentity) {
            console.log(`${colors.yellow}  ⚠️  ${participant.id} already exists in wallet${colors.reset}`);
            return { success: true, existed: true };
        }

        // Get admin identity
        const adminIdentity = await wallet.get(participant.admin);
        if (!adminIdentity) {
            throw new Error(`Admin ${participant.admin} not found. Run 'npm run register-admin' first.`);
        }

        // Build admin user context
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, participant.admin);

        // Register the participant with the CA
        const secret = await ca.register({
            affiliation: `${participant.org}.department1`.toLowerCase(),
            enrollmentID: participant.id,
            role: 'client',
            attrs: [
                { name: 'role', value: participant.role, ecert: true },
                { name: 'organizationName', value: participant.details.name, ecert: true },
                { name: 'location', value: participant.details.location, ecert: true }
            ]
        }, adminUser);

        // Enroll the participant
        const enrollment = await ca.enroll({
            enrollmentID: participant.id,
            enrollmentSecret: secret,
            attr_reqs: [
                { name: 'role', optional: false },
                { name: 'organizationName', optional: false },
                { name: 'location', optional: false }
            ]
        });

        // Create X.509 identity
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: `${participant.org}MSP`,
            type: 'X.509',
        };

        // Store in wallet
        await wallet.put(participant.id, x509Identity);
        
        if (verbose) {
            console.log(`${colors.green}  ✅ ${participant.id} registered successfully${colors.reset}`);
            console.log(`${colors.magenta}     Name: ${participant.details.name}${colors.reset}`);
            console.log(`${colors.magenta}     Location: ${participant.details.location}${colors.reset}`);
        }

        // Initialize on blockchain
        await initializeOnBlockchain(participant, ccp, wallet);

        return { success: true, existed: false };

    } catch (error) {
        console.error(`${colors.red}  ❌ Failed to register ${participant.id}: ${error.message}${colors.reset}`);
        return { success: false, error: error.message };
    }
}

// Initialize participant on the blockchain
async function initializeOnBlockchain(participant, ccp, wallet) {
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
            organizationName: participant.details.name,
            location: participant.details.location,
            contact: participant.details.contact,
            description: participant.details.description,
            registeredDate: new Date().toISOString(),
            status: 'ACTIVE'
        };

        await contract.submitTransaction('createParticipant', JSON.stringify(participantData));
        console.log(`${colors.green}     📝 Recorded on blockchain${colors.reset}`);

    } catch (error) {
        // Chaincode might not be deployed yet
        console.log(`${colors.yellow}     ⏳ Blockchain recording pending (chaincode may not be deployed)${colors.reset}`);
    } finally {
        if (gateway) {
            await gateway.disconnect();
        }
    }
}

// Register custom participant from command line
async function registerCustomParticipant(args) {
    const participant = {
        id: args.id,
        role: args.role,
        admin: args.role === 'farmer' || args.role === 'shipper' ? 'farmerAdmin' : 'manufacturerAdmin',
        org: args.role === 'farmer' || args.role === 'shipper' ? 'Org1' : 'Org2',
        details: {
            name: args.name || `${args.role}-${args.id}`,
            location: args.location || 'Not specified',
            contact: args.contact || `${args.id}@example.com`,
            description: args.description || `Custom ${args.role}`
        }
    };

    return await registerParticipant(participant);
}

// Main function
async function main() {
    console.log(`${colors.bright}${colors.cyan}===========================================${colors.reset}`);
    console.log(`${colors.bright}  Product Tracing - Participant Registration  ${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}===========================================${colors.reset}\n`);

    const args = process.argv.slice(2);

    // Check for help flag
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }

    try {
        // Check if wallet exists
        const walletPath = path.join(process.cwd(), 'wallet');
        if (!fs.existsSync(walletPath)) {
            throw new Error('Wallet not found. Run "npm run register-admin" first.');
        }

        // Custom participant registration
        if (args.includes('--custom') || args.includes('-c')) {
            const customArgs = parseCustomArgs(args);
            if (!customArgs.id || !customArgs.role) {
                console.error(`${colors.red}Error: --id and --role are required for custom registration${colors.reset}`);
                showHelp();
                process.exit(1);
            }
            
            console.log(`${colors.cyan}Registering custom participant...${colors.reset}\n`);
            const result = await registerCustomParticipant(customArgs);
            
            if (result.success) {
                console.log(`\n${colors.green}✅ Custom participant registered successfully!${colors.reset}`);
            } else {
                console.log(`\n${colors.red}❌ Failed to register custom participant${colors.reset}`);
                process.exit(1);
            }
        } else {
            // Register default participants
            console.log(`${colors.cyan}Registering default participants...${colors.reset}\n`);
            
            let successCount = 0;
            let existedCount = 0;
            let failedCount = 0;

            for (const participant of DEFAULT_PARTICIPANTS) {
                const result = await registerParticipant(participant);
                if (result.success) {
                    if (result.existed) {
                        existedCount++;
                    } else {
                        successCount++;
                    }
                } else {
                    failedCount++;
                }
                console.log(); // Empty line between participants
            }

            // Summary
            console.log(`${colors.bright}${colors.cyan}===========================================${colors.reset}`);
            console.log(`${colors.bright}  Registration Summary${colors.reset}`);
            console.log(`${colors.bright}${colors.cyan}===========================================${colors.reset}`);
            console.log(`${colors.green}✅ Newly registered: ${successCount}${colors.reset}`);
            console.log(`${colors.yellow}⚠️  Already existed: ${existedCount}${colors.reset}`);
            if (failedCount > 0) {
                console.log(`${colors.red}❌ Failed: ${failedCount}${colors.reset}`);
            }
        }

        console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
        console.log('1. Start the server: npm start');
        console.log('2. Test the API: curl http://localhost:5000/status\n');

    } catch (error) {
        console.error(`\n${colors.red}Registration failed!${colors.reset}`);
        console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
        process.exit(1);
    }
}

// Parse custom arguments
function parseCustomArgs(args) {
    const parsed = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--id' && i + 1 < args.length) {
            parsed.id = args[i + 1];
        } else if (args[i] === '--role' && i + 1 < args.length) {
            parsed.role = args[i + 1];
        } else if (args[i] === '--name' && i + 1 < args.length) {
            parsed.name = args[i + 1];
        } else if (args[i] === '--location' && i + 1 < args.length) {
            parsed.location = args[i + 1];
        } else if (args[i] === '--contact' && i + 1 < args.length) {
            parsed.contact = args[i + 1];
        } else if (args[i] === '--description' && i + 1 < args.length) {
            parsed.description = args[i + 1];
        }
    }
    return parsed;
}

// Show help message
function showHelp() {
    console.log(`${colors.cyan}Participant Registration Script${colors.reset}`);
    console.log('\nUsage:');
    console.log('  node scripts/registerParticipants.js           # Register default participants');
    console.log('  node scripts/registerParticipants.js --custom  # Register custom participant');
    console.log('\nOptions:');
    console.log('  -h, --help         Show this help message');
    console.log('  -c, --custom       Register a custom participant');
    console.log('\nCustom participant options:');
    console.log('  --id <id>          Participant ID (required)');
    console.log('  --role <role>      Role: farmer|manufacturer|distributor|retailer|shipper (required)');
    console.log('  --name <name>      Organization name');
    console.log('  --location <loc>   Location');
    console.log('  --contact <email>  Contact email');
    console.log('  --description <d>  Description');
    console.log('\nExample:');
    console.log('  node scripts/registerParticipants.js --custom --id farmer03 --role farmer \\');
    console.log('    --name "Happy Farms" --location "Idaho, USA"');
}

// Run the main function
main();
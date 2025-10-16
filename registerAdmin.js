#!/usr/bin/env node
'use strict';

/**
 * Register Admin Users for all organizations
 * This script enrolls the admin users for each organization in the network
 */

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m'
};

// Register admin for Org1 (Farmers and Shippers)
async function registerOrg1Admin() {
    try {
        console.log(`${colors.cyan}Registering Admin for Organization 1 (Farmers/Shippers)...${colors.reset}`);
        
        // Load the network configuration
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
        
        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Connection profile not found at ${ccpPath}. Please ensure Fabric network is set up.`);
        }
        
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(
            caInfo.url,
            { trustedRoots: caTLSCACerts, verify: false },
            caInfo.caName
        );

        // Create a new file system based wallet for managing identities
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the admin user
        const identity = await wallet.get('farmerAdmin');
        if (identity) {
            console.log(`${colors.yellow}⚠️  An identity for "farmerAdmin" already exists in the wallet${colors.reset}`);
            return;
        }

        // Enroll the admin user, and import the new identity into the wallet
        const enrollment = await ca.enroll({
            enrollmentID: 'admin',
            enrollmentSecret: 'adminpw'
        });
        
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        
        await wallet.put('farmerAdmin', x509Identity);
        console.log(`${colors.green}✅ Successfully enrolled admin "farmerAdmin" for Org1 and imported it into the wallet${colors.reset}`);

    } catch (error) {
        console.error(`${colors.red}❌ Failed to enroll admin for Org1: ${error.message}${colors.reset}`);
        throw error;
    }
}

// Register admin for Org2 (Manufacturers, Distributors, Retailers)
async function registerOrg2Admin() {
    try {
        console.log(`${colors.cyan}Registering Admin for Organization 2 (Manufacturers/Distributors/Retailers)...${colors.reset}`);
        
        // Load the network configuration
        const ccpPath = path.resolve(
            __dirname,
            '../..',
            'fabric-samples',
            'test-network',
            'organizations',
            'peerOrganizations',
            'org2.example.com',
            'connection-org2.json'
        );
        
        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Connection profile not found at ${ccpPath}. Please ensure Fabric network is set up.`);
        }
        
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA
        const caInfo = ccp.certificateAuthorities['ca.org2.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(
            caInfo.url,
            { trustedRoots: caTLSCACerts, verify: false },
            caInfo.caName
        );

        // Create a new file system based wallet for managing identities
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check to see if we've already enrolled the admin user
        const identity = await wallet.get('manufacturerAdmin');
        if (identity) {
            console.log(`${colors.yellow}⚠️  An identity for "manufacturerAdmin" already exists in the wallet${colors.reset}`);
            return;
        }

        // Enroll the admin user, and import the new identity into the wallet
        const enrollment = await ca.enroll({
            enrollmentID: 'admin',
            enrollmentSecret: 'adminpw'
        });
        
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org2MSP',
            type: 'X.509',
        };
        
        await wallet.put('manufacturerAdmin', x509Identity);
        console.log(`${colors.green}✅ Successfully enrolled admin "manufacturerAdmin" for Org2 and imported it into the wallet${colors.reset}`);

    } catch (error) {
        console.error(`${colors.red}❌ Failed to enroll admin for Org2: ${error.message}${colors.reset}`);
        throw error;
    }
}

// Register a system admin (optional - for cross-organization operations)
async function registerSystemAdmin() {
    try {
        console.log(`${colors.cyan}Registering System Admin...${colors.reset}`);
        
        // Using Org1 as the base for system admin
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
        
        if (!fs.existsSync(ccpPath)) {
            throw new Error(`Connection profile not found at ${ccpPath}`);
        }
        
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(
            caInfo.url,
            { trustedRoots: caTLSCACerts, verify: false },
            caInfo.caName
        );

        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check if system admin already exists
        const identity = await wallet.get('systemAdmin');
        if (identity) {
            console.log(`${colors.yellow}⚠️  An identity for "systemAdmin" already exists in the wallet${colors.reset}`);
            return;
        }

        // Enroll system admin
        const enrollment = await ca.enroll({
            enrollmentID: 'admin',
            enrollmentSecret: 'adminpw'
        });
        
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        
        await wallet.put('systemAdmin', x509Identity);
        console.log(`${colors.green}✅ Successfully enrolled "systemAdmin" and imported it into the wallet${colors.reset}`);

    } catch (error) {
        console.error(`${colors.red}❌ Failed to enroll system admin: ${error.message}${colors.reset}`);
        throw error;
    }
}

// Main function to register all admins
async function main() {
    console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}`);
    console.log(`${colors.bright}  Product Tracing - Admin Registration  ${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}========================================${colors.reset}\n`);

    try {
        // Create wallet directory if it doesn't exist
        const walletPath = path.join(process.cwd(), 'wallet');
        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
            console.log(`${colors.green}Created wallet directory at ${walletPath}${colors.reset}\n`);
        }

        // Register admins for both organizations
        await registerOrg1Admin();
        console.log();
        
        await registerOrg2Admin();
        console.log();
        
        // Optionally register system admin
        const args = process.argv.slice(2);
        if (args.includes('--system') || args.includes('-s')) {
            await registerSystemAdmin();
            console.log();
        }

        console.log(`${colors.bright}${colors.green}========================================${colors.reset}`);
        console.log(`${colors.bright}${colors.green}  Admin Registration Complete! 🎉       ${colors.reset}`);
        console.log(`${colors.bright}${colors.green}========================================${colors.reset}`);
        console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
        console.log('1. Register participants: npm run register-participants');
        console.log('2. Start the server: npm start\n');

    } catch (error) {
        console.error(`\n${colors.red}Admin registration failed!${colors.reset}`);
        console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
        console.error(`\n${colors.yellow}Troubleshooting tips:${colors.reset}`);
        console.error('1. Ensure the Fabric network is running');
        console.error('2. Check if fabric-samples/test-network exists');
        console.error('3. Run: cd ../fabric-samples/test-network && ./network.sh up createChannel -ca');
        process.exit(1);
    }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`${colors.cyan}Admin Registration Script${colors.reset}`);
    console.log('\nUsage: node scripts/registerAdmin.js [options]');
    console.log('\nOptions:');
    console.log('  -s, --system    Also register a system admin');
    console.log('  -h, --help      Show this help message');
    console.log('\nThis script registers admin users for all organizations in the network.');
    process.exit(0);
}

// Run the main function
main();
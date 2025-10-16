'use strict';

const express = require('express');
const bodyParser = require('body-parser')
const helper = require('./helper');
const invoke = require('./invoke');
const query = require('./query');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({origins:['*']}));

async function main() {
    try {
        // load the network configuration
        const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA.
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the admin user.
        const identity = await wallet.get('hospitalAdmin');
        if (identity) {
            console.log('An identity for the admin user "admin" already exists in the wallet');
            return;
        }

        // Enroll the admin user, and import the new identity into the wallet.
        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put('hospitalAdmin', x509Identity);
        console.log('Successfully enrolled admin user "admin1" and imported it into the wallet');

    } catch (error) {
        console.error(`Failed to enroll admin user "admin1": ${error}`);
        process.exit(1);
    }
}

async function main2() {
    try {
        // load the network configuration
        const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org2.example.com', 'connection-org2.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA.
        const caInfo = ccp.certificateAuthorities['ca.org2.example.com'];
        const caTLSCACerts = caInfo.tlsCACerts.pem;
        const ca = new FabricCAServices(caInfo.url, { trustedRoots: caTLSCACerts, verify: false }, caInfo.caName);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the admin user.
        const identity = await wallet.get('insuranceAdmin');
        if (identity) {
            console.log('An identity for the admin user "insuranceAdmin" already exists in the wallet');
            return;
        }

        // Enroll the admin user, and import the new identity into the wallet.
        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org2MSP',
            type: 'X.509',
        };
        await wallet.put('insuranceAdmin', x509Identity);
        console.log('Successfully enrolled admin user "insuranceAdmin" and imported it into the wallet');

    } catch (error) {
        console.error(`Failed to enroll admin user "insuranceAdmin": ${error}`);
        process.exit(1);
    }
}

async function main3() {
    try {
        // load the network configuration
        const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        // const ccpPath = path.resolve(__dirname, '..', '..','HLF-Alpha_token-Faucet', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA.
        const caURL = ccp.certificateAuthorities['ca.org1.example.com'].url;
        const ca = new FabricCAServices(caURL);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get('Hospital01');
        if (userIdentity) {
            console.log('An identity for the user "Hospital01" already exists in the wallet');
            return;
        }

        // Check to see if we've already enrolled the hospitalAdmin user.
        const adminIdentity = await wallet.get('hospitalAdmin');
        if (!adminIdentity) {
            console.log('An identity for the hospitalAdmin user "hospitalAdmin" does not exist in the wallet');
            console.log('Run the enrollAdmin.js application before retrying');
            return;
        }

        // build a user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'hospitalAdmin');

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({
            affiliation: 'org1.department1',
            enrollmentID: 'Hospital01',
            role: 'client',
            attrs: [{ name: 'role', value: 'hospital', ecert: true },{ name: 'uuid', value: 'Hospital01', ecert: true }],
        }, adminUser);
        const enrollment = await ca.enroll({
            enrollmentID: 'Hospital01',
            enrollmentSecret: secret,
            attr_reqs: [{ name: "role", optional: false },{ name: "uuid", optional: false }]
        });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put('Hospital01', x509Identity);
        console.log('Successfully registered and enrolled hospitalAdmin user "Hospital01" and imported it into the wallet');
    } catch (error) {
        console.error(`Failed to register user "Hospital01": ${error}`);
        process.exit(1);
      }
}

async function main4() {
    try {
        // load the network configuration
        const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        // const ccpPath = path.resolve(__dirname, '..', '..','HLF-Alpha_token-Faucet', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // Create a new CA client for interacting with the CA.
        const caURL = ccp.certificateAuthorities['ca.org1.example.com'].url;
        const ca = new FabricCAServices(caURL);

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userIdentity = await wallet.get('Doctor-Rama04');
        if (userIdentity) {
            console.log('An identity for the user "Doctor-Rama04" already exists in the wallet');
            return;
        }

        // Check to see if we've already enrolled the hospitalAdmin user.
        const adminIdentity = await wallet.get('hospitalAdmin');
        if (!adminIdentity) {
            console.log('An identity for the hospitalAdmin user "hospitalAdmin" does not exist in the wallet');
            console.log('Run the enrollAdmin.js application before retrying');
            return;
        }

        // build a user object for authenticating with the CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'hospitalAdmin');

        // Register the user, enroll the user, and import the new identity into the wallet.
        const secret = await ca.register({
            affiliation: 'org1.department1',
            enrollmentID: 'Doctor-Rama04',
            role: 'client',
            attrs: [{ name: 'role', value: 'doctor', ecert: true },{ name: 'uuid', value: 'Doctor-Rama04', ecert: true }],
        }, adminUser);
        const enrollment = await ca.enroll({
            enrollmentID: 'Doctor-Rama04',
            enrollmentSecret: secret,
            attr_reqs: [{ name: "role", optional: false },{ name: "uuid", optional: false }]
        });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        await wallet.put('Doctor-Rama04', x509Identity);
        console.log('Successfully registered and enrolled hospitalAdmin user "Doctor-Rama04" and imported it into the wallet');

        // -----------------------Create Wallet with default balance on ledger------------------ 
                // Create a new gateway for connecting to our peer node.
                const gateway = new Gateway();
                await gateway.connect(ccp, { wallet, identity: 'Hospital01', discovery: { enabled: true, asLocalhost: true } });
        
                // Get the network (channel) our contract is deployed to.
                const network = await gateway.getNetwork('mychannel');
        
                // Get the contract from the network.
                const contract = network.getContract('basic');

                // let doctorId="Doctor-Rama04";
                // let hospitalName="Hospital01-ABC";
                // let name="Rama";
                // let city="Pune";

                const args = {
                    doctorId: "Doctor-Rama04",
                    hospitalName: "Hospital01-ABC",
                    name: "Dr. Raj",
                    city: "Pune"
                };  

                const res = await contract.submitTransaction('onboardDoctor', JSON.stringify(args));
                console.log("/n === Onboard Doctor success === /n", res.toString());
        
                // const result2 = await contract.evaluateTransaction('GetAllAssets');
                // console.log('/n === GetAllAssets === /n', result2.toString());

                // Disconnect from the gateway.
                gateway.disconnect();

    } catch (error) {
        console.error(`Failed to register user "Doctor-Rama04": ${error}`);
        process.exit(1);
      }
}



app.listen(5000, function () {
    console.log('Node SDK server is running on 5000 port :) ');
});

app.get('/status', async function (req, res, next) {
    console.log('server is up')
    res.send("Server is up.");
})

app.get('/init', async (req, res, next)=>{
main()
    .then((res) => main2())
    .then(() => main3())
    .then(() => main4())
    .catch((error) => {
        next(error)
        res.json({success:false, error})
        console.error('Error:', error);
    });
    res.json({success:true})
})




app.post('/registerPatient', async function (req, res, next) {
    try {
        let role; 
        
        
        // check request body
        console.log("Received request:", req.body);
        let {adminId, doctorId, userId, name, dob, city} = req.body;
        if (req.body.userId && req.body.adminId) {
            userId = req.body.userId;
            
            adminId = req.body.adminId;
        } else {
            console.log("Missing input data. Please enter all the user details.");
            throw new Error("Missing input data. Please enter all the user details.");
        }
        
        role='patient';

        //call registerEnrollUser function and pass the above as parameters to the function
        const result = await helper.registerUser(adminId, doctorId, userId, role, { name, dob, city});
        console.log("Result from user registration function:", result);

        // check register function response and set API response accordingly 
        res.status(200).send(result);
    } catch (error) {
        console.log("There was an error while registering the user. Error is ", error);
        next(error);
    }  
});

app.post('/loginPatient', async function (req, res, next){
    try {
        let userId;

        // check request body        
        if (req.body.userId) {
            userId = req.body.userId;
            
        } else {
            console.log("Missing input data. Please enter all the user details.");
            throw new Error("Missing input data. Please enter all the user details.");
        }

        const result = await helper.login(userId);
        console.log("Result from user login function: ", result);
        //check response returned by login function and set API response accordingly
        res.status(200).send(result);
    } catch (error) {
        console.log("There was an error while logging in. Error is ", error);
        next(error);
    }

});


app.post('/queryHistoryOfAsset', async function (req, res, next){
    try {
        //  queryHistory(ctx, Id)
        let userId = req.body.userId;
        let recordId = req.body.recordId;
      
        const result = await query.getQuery('queryHistoryOfAsset',{recordId}, userId);
        // console.log("Response from chaincode", result);
        //check response returned by login function and set API response accordingly
        res.status(200).send(JSON.parse(result.data));
    } catch (error) {       
        next(error);
    }
});


app.post('/addRecord', async function (req, res, next){
    try {
        //  Only doctors can add records
        const {userId, patientId, diagnosis, prescription} = req.body;
        const result = await invoke.invokeTransaction('addRecord', {patientId, diagnosis, prescription}, userId);
              
        res.send({sucess:true, data: result})
                
    } catch (error) {       
        next(error);
    }
});


app.post('/getAllRecordsByPatientId', async function (req, res, next){
    try {
        // getAllRecordsByPatientId(ctx, patientId
        const {userId, patientId} = req.body;  
        const result = await query.getQuery('getAllRecordsByPatientId',{patientId}, userId);

        console.log("Response from chaincode", result);
        res.status(200).send({ success: true, data:result});

    } catch (error) {       
        next(error);
    }
});

app.post('/getRecordById', async function (req, res, next){
    try {
        // getRecordById(ctx, patientId, recordId)
        const {userId, patientId, recordId} = req.body;  
        const result = await query.getQuery('getRecordById',{patientId, recordId}, userId);

        console.log("Response from chaincode", result);
        res.status(200).send({ success: true, data:result});

    } catch (error) {       
        next(error);
    }
});

app.post('/grantAccess', async function (req, res, next){
    try {
        // call this from patient 
        // grantAccess(ctx, patientId, doctorIdToGrant) - call by patient
        const {userId, patientId, doctorIdToGrant} = req.body;  
        const result = await invoke.invokeTransaction('grantAccess',{patientId:patientId, doctorIdToGrant:doctorIdToGrant}, userId);

        console.log("Response from chaincode", result);
        res.status(200).send({ success: true, data:result});

    } catch (error) {       
        next(error);
    }
});

// create Faucet Wallet only admin can call.
// fetchLedger(ctx, timeStamp, amount, timeDelay)
app.post('/fetchLedger', async function (req, res, next){
    try {
        let userId = req.body.userId;
        // fetchLedger(ctx)
        const result = await query.getQuery('fetchLedger', {}, userId);
        console.log("Response from chaincode", result);
        //check response returned by login function and set API response accordingly
            res.status(200).send({ success: true, data:result})

    } catch (error) {       
        next(error);
    }
});


app.use((err, req, res, next) => {
    res.status(400).send(err.message);
})

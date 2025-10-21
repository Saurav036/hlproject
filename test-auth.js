/**
 * Test script for JWT authentication
 * Run with: node test-auth.js
 */

const { generateToken, verifyToken, requireRole, getAllRoles, JWT_SECRET } = require('./authMiddleware');
const jwt = require('jsonwebtoken');

console.log('=== WyldTrace JWT Authentication Test ===\n');

// Test 1: Generate Token
console.log('Test 1: Generate Token');
const token = generateToken('farmer01', 'farmer', {
    organizationName: 'Green Farm Co.',
    location: 'California'
});
console.log('✅ Token generated successfully');
console.log('Token:', token.substring(0, 50) + '...\n');

// Test 2: Decode Token
console.log('Test 2: Decode Token');
try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token decoded successfully');
    console.log('Decoded payload:', JSON.stringify(decoded, null, 2));
    console.log('');
} catch (error) {
    console.log('❌ Failed to decode token:', error.message);
}

// Test 3: Token Expiry Check
console.log('Test 3: Token Expiry Check');
const decoded = jwt.decode(token);
const expiryTime = new Date(decoded.exp * 1000);
console.log('✅ Token expires at:', expiryTime.toLocaleString());
console.log('Time until expiry:', Math.round((decoded.exp * 1000 - Date.now()) / (1000 * 60 * 60)), 'hours\n');

// Test 4: Get All Roles
console.log('Test 4: Get All Roles');
const roles = getAllRoles();
console.log('✅ Retrieved', Object.keys(roles).length, 'roles:');
Object.keys(roles).forEach(roleKey => {
    console.log(`  - ${roles[roleKey].name} (${roleKey})`);
});
console.log('');

// Test 5: Mock Request/Response for verifyToken
console.log('Test 5: Verify Token Middleware');
const mockReq = {
    headers: {
        authorization: `Bearer ${token}`
    }
};
const mockRes = {
    status: (code) => ({
        json: (data) => {
            console.log('❌ Response status:', code);
            console.log('Response data:', data);
        }
    })
};
const mockNext = () => {
    console.log('✅ Token verified successfully');
    console.log('User extracted from token:', mockReq.user);
};

verifyToken(mockReq, mockRes, mockNext);
console.log('');

// Test 6: Role-Based Access Control
console.log('Test 6: Role-Based Access Control');
const farmerReq = {
    user: {
        userID: 'farmer01',
        userRole: 'farmer'
    }
};

const testRoleAccess = (requiredRoles, userRole) => {
    const req = { user: { userID: 'test', userRole } };
    const res = {
        status: (code) => ({
            json: (data) => {
                console.log(`  ❌ ${userRole} blocked from [${requiredRoles.join(', ')}]`);
                return { code, data };
            }
        })
    };
    const next = () => {
        console.log(`  ✅ ${userRole} allowed access to [${requiredRoles.join(', ')}]`);
    };

    const middleware = requireRole(...requiredRoles);
    middleware(req, res, next);
};

// Test farmer accessing farmer-only endpoint
testRoleAccess(['farmer'], 'farmer');

// Test farmer accessing manufacturer-only endpoint
testRoleAccess(['manufacturer'], 'farmer');

// Test admin accessing farmer-only endpoint
testRoleAccess(['farmer'], 'admin');

// Test admin accessing any endpoint
testRoleAccess(['farmer', 'manufacturer', 'retailer'], 'admin');

console.log('');

// Test 7: Invalid Token
console.log('Test 7: Invalid Token Handling');
const invalidReq = {
    headers: {
        authorization: 'Bearer invalid.token.here'
    }
};
const invalidRes = {
    status: (code) => ({
        json: (data) => {
            console.log('✅ Invalid token properly rejected');
            console.log('   Status:', code);
            console.log('   Message:', data.message);
        }
    })
};
verifyToken(invalidReq, invalidRes, () => {
    console.log('❌ Invalid token was accepted!');
});

console.log('\n=== All Tests Complete ===');

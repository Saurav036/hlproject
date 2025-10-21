# Example Console Output with Logging

## What You'll See When Running the Server

### 1. Server Startup

```bash
$ npm start

> product-tracing-backend@1.0.0 start
> node app.js

================================================================================
🚀 Product tracing server is running
📍 Port: 5000
🕐 Started at: 2025-10-21T16:53:45.123Z
================================================================================
```

---

### 2. Health Check Request

**Request:**
```bash
curl http://localhost:5000/status
```

**Console Output:**
```bash
================================================================================
[2025-10-21T16:54:00.456Z] GET /status
================================================================================

[GET /status] Health check requested
```

---

### 3. Get Roles Request

**Request:**
```bash
curl http://localhost:5000/roles
```

**Console Output:**
```bash
================================================================================
[2025-10-21T16:54:05.789Z] GET /roles
================================================================================

[GET /roles] Fetching role definitions
[GET /roles] ✅ Retrieved 6 roles
```

---

### 4. Login Request (Successful)

**Request:**
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"userId": "farmer01"}'
```

**Console Output:**
```bash
================================================================================
[2025-10-21T16:54:10.123Z] POST /login
================================================================================
Request Body: {
  "userId": "farmer01"
}

[POST /login] Login attempt started
[POST /login] Authenticating user: farmer01
Wallet path: D:\WyldTrace\project\hlproject\wallet
[POST /login] User authenticated, generating JWT...
[POST /login] ✅ Login successful for: farmer01 | Role: farmer
```

---

### 5. Login Request (Failed - User Not Found)

**Request:**
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"userId": "unknown_user"}'
```

**Console Output:**
```bash
================================================================================
[2025-10-21T16:54:15.456Z] POST /login
================================================================================
Request Body: {
  "userId": "unknown_user"
}

[POST /login] Login attempt started
[POST /login] Authenticating user: unknown_user
Wallet path: D:\WyldTrace\project\hlproject\wallet
[POST /login] ❌ Authentication failed: User unknown_user not found. Please register first.
```

---

### 6. Create Product Request (Successful)

**Request:**
```bash
curl -X POST http://localhost:5000/createProduct \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Organic Tomatoes",
    "productType": "vegetable",
    "quantity": 100,
    "unit": "kg",
    "location": "Farm A"
  }'
```

**Console Output:**
```bash
================================================================================
[2025-10-21T16:54:20.789Z] POST /createProduct
================================================================================
Request Body: {
  "productName": "Organic Tomatoes",
  "productType": "vegetable",
  "quantity": 100,
  "unit": "kg",
  "location": "Farm A"
}
Authorization: Bearer eyJhbGciOiJIUzI...

[POST /createProduct] Product creation request
[POST /createProduct] User: farmer01 | Role: farmer
[POST /createProduct] Invoking blockchain transaction...
Wallet path: D:\WyldTrace\project\hlproject\wallet
Invoking transaction: createProduct with args: {
  productName: 'Organic Tomatoes',
  productType: 'vegetable',
  quantity: 100,
  unit: 'kg',
  harvestDate: '2025-10-21T16:54:20.789Z',
  location: 'Farm A',
  certifications: [],
  status: 'CREATED'
}
Transaction createProduct completed successfully
[POST /createProduct] ✅ Product created successfully
```

---

### 7. Create Product Request (Failed - Missing Token)

**Request:**
```bash
curl -X POST http://localhost:5000/createProduct \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Tomatoes",
    "productType": "vegetable",
    "quantity": 100
  }'
```

**Console Output:**
```bash
================================================================================
[2025-10-21T16:54:25.123Z] POST /createProduct
================================================================================
Request Body: {
  "productName": "Tomatoes",
  "productType": "vegetable",
  "quantity": 100
}

❌ ERROR HANDLER CAUGHT:
Message: No authorization token provided
Stack: Error: No authorization token provided
    at verifyToken (D:\WyldTrace\project\hlproject\authMiddleware.js:25:20)
    at Layer.handle [as handle_request] (...express/router/layer.js:95:5)
    ...
```

---

### 8. Create Product Request (Failed - Wrong Role)

**Request:**
```bash
# Token for shipper01 trying to create product
curl -X POST http://localhost:5000/createProduct \
  -H "Authorization: Bearer <shipper_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productName": "Tomatoes",
    "productType": "vegetable",
    "quantity": 100
  }'
```

**Console Output:**
```bash
================================================================================
[2025-10-21T16:54:30.456Z] POST /createProduct
================================================================================
Request Body: {
  "productName": "Tomatoes",
  "productType": "vegetable",
  "quantity": 100
}
Authorization: Bearer eyJhbGciOiJIUzI...

❌ ERROR HANDLER CAUGHT:
Message: Access denied. Required role(s): farmer, admin
Stack: Error: Access denied...
```

---

### 9. Transfer Ownership Request

**Request:**
```bash
curl -X POST http://localhost:5000/transferOwnership \
  -H "Authorization: Bearer <farmer_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PROD-001",
    "newOwnerId": "manufacturer01",
    "price": 500
  }'
```

**Console Output:**
```bash
================================================================================
[2025-10-21T16:54:35.789Z] POST /transferOwnership
================================================================================
Request Body: {
  "productId": "PROD-001",
  "newOwnerId": "manufacturer01",
  "price": 500
}
Authorization: Bearer eyJhbGciOiJIUzI...

[POST /transferOwnership] Ownership transfer request
[POST /transferOwnership] From: farmer01 | To: manufacturer01 | Product: PROD-001
[POST /transferOwnership] Invoking blockchain transaction...
Wallet path: D:\WyldTrace\project\hlproject\wallet
Invoking transaction: transferOwnership with args: {
  productId: 'PROD-001',
  newOwnerId: 'manufacturer01',
  price: 500,
  notes: undefined,
  timestamp: '2025-10-21T16:54:35.789Z'
}
Transaction transferOwnership completed successfully
[POST /transferOwnership] ✅ Ownership transferred
```

---

### 10. Get Products by Owner

**Request:**
```bash
curl -X GET "http://localhost:5000/getProductsByOwner?ownerId=farmer01" \
  -H "Authorization: Bearer <farmer_token>"
```

**Console Output:**
```bash
================================================================================
[2025-10-21T16:54:40.123Z] GET /getProductsByOwner
================================================================================
Query Params: {
  "ownerId": "farmer01"
}
Authorization: Bearer eyJhbGciOiJIUzI...

[GET /getProductsByOwner] Query products by owner
[GET /getProductsByOwner] User: farmer01 | Owner: farmer01
[GET /getProductsByOwner] Querying blockchain...
Wallet path: D:\WyldTrace\project\hlproject\wallet
Executing query: getProductsByOwner with args: { ownerId: 'farmer01' }
Query getProductsByOwner executed successfully
[GET /getProductsByOwner] ✅ Products retrieved
```

---

### 11. Register Participant (Blockchain)

**Request:**
```bash
curl -X POST http://localhost:5000/registerParticipant \
  -H "Content-Type: application/json" \
  -d '{
    "adminId": "farmerAdmin",
    "userId": "farmer02",
    "role": "farmer",
    "organizationName": "Green Valley Farm",
    "location": "California"
  }'
```

**Console Output:**
```bash
================================================================================
[2025-10-21T16:54:45.456Z] POST /registerParticipant
================================================================================
Request Body: {
  "adminId": "farmerAdmin",
  "userId": "farmer02",
  "role": "farmer",
  "organizationName": "Green Valley Farm",
  "location": "California"
}

[POST /registerParticipant] Blockchain participant registration
[POST /registerParticipant] Calling helper.registerUser for: farmer02
Wallet path: D:\WyldTrace\project\hlproject\wallet
Successfully registered and enrolled user farmer02
[POST /registerParticipant] ✅ Success: farmer02 registered successfully
```

---

### 12. Error - Blockchain Not Running

**Request:**
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"userId": "farmer01"}'
```

**Console Output (when blockchain/wallet not set up):**
```bash
================================================================================
[2025-10-21T16:54:50.789Z] POST /login
================================================================================
Request Body: {
  "userId": "farmer01"
}

[POST /login] Login attempt started
[POST /login] Authenticating user: farmer01
Wallet path: D:\WyldTrace\project\hlproject\wallet
[POST /login] ❌ Login error: User farmer01 not found in wallet
[POST /login] Stack: Error: User farmer01 not found in wallet
    at login (D:\WyldTrace\project\hlproject\helper.js:169:20)
    at app.js:227:32
    ...

❌ ERROR HANDLER CAUGHT:
Message: User farmer01 not found in wallet
Stack: Error: User farmer01 not found in wallet...
```

---

## What to Look For When Debugging

### ✅ **Success Indicators**
- Look for checkmarks: ✅
- "successfully" messages
- No error stack traces

### ❌ **Error Indicators**
- Cross marks: ❌
- "failed", "error", "missing" messages
- Stack traces
- "ERROR HANDLER CAUGHT" messages

### 📍 **Important Checkpoints**
1. **Server started** - First thing you see
2. **Request received** - Request reaches server
3. **User authenticated** - Token verified
4. **Validation passed** - Required fields present
5. **Blockchain call** - Transaction invoked
6. **Success** - Operation completed

---

## Pro Tips

### Tip 1: Watch for Missing Wallet
```
Wallet path: D:\WyldTrace\project\hlproject\wallet
❌ User farmer01 not found in wallet
```
**Solution**: Run `npm run register-admin` first

### Tip 2: Watch for Missing Token
```
❌ ERROR HANDLER CAUGHT:
Message: No authorization token provided
```
**Solution**: Include `Authorization: Bearer <token>` header

### Tip 3: Watch for Wrong Role
```
❌ ERROR HANDLER CAUGHT:
Message: Access denied. Required role(s): farmer, admin
```
**Solution**: Use correct user role for the endpoint

### Tip 4: Watch for Blockchain Connection
```
[POST /createProduct] Invoking blockchain transaction...
❌ Error: ECONNREFUSED
```
**Solution**: Start Hyperledger Fabric network first

---

## Full Example Session

```bash
# Terminal 1: Start server
$ cd hlproject
$ npm start

================================================================================
🚀 Product tracing server is running
📍 Port: 5000
🕐 Started at: 2025-10-21T16:53:45.123Z
================================================================================

# Terminal 2: Make requests
$ curl http://localhost:5000/roles

# Back to Terminal 1: See logs
================================================================================
[2025-10-21T16:54:00.000Z] GET /roles
================================================================================
[GET /roles] Fetching role definitions
[GET /roles] ✅ Retrieved 6 roles

# Terminal 2: Login
$ curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"userId": "farmer01"}'

# Back to Terminal 1: See detailed login logs
================================================================================
[2025-10-21T16:54:05.000Z] POST /login
================================================================================
Request Body: {
  "userId": "farmer01"
}
[POST /login] Login attempt started
[POST /login] Authenticating user: farmer01
[POST /login] User authenticated, generating JWT...
[POST /login] ✅ Login successful for: farmer01 | Role: farmer
```

---

**Now you can track every step of every request and easily identify where things go wrong!** 🎉

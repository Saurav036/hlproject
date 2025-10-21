# Backend Logging Guide

## Overview

Comprehensive console.log statements have been added to **every endpoint** in the backend to help you:
- ✅ Track exactly where code is executing
- ✅ Identify errors at each step
- ✅ Debug authentication and authorization
- ✅ Monitor blockchain interactions
- ✅ Trace data flow through the application

---

## Logging Features

### 1. Request Logging Middleware

**Every incoming request** is automatically logged with:
```
================================================================================
[2025-10-21T12:34:56.789Z] POST /login
================================================================================
Request Body: {
  "userId": "farmer01"
}
Authorization: Bearer eyJhbGciOiJIUzI...
```

### 2. Endpoint-Specific Logging

Each endpoint has detailed logs showing:
- ✅ When the endpoint is called
- ✅ What data was received
- ✅ Which user is making the request (for protected routes)
- ✅ Each processing step
- ✅ Success or failure status
- ✅ Error messages with stack traces

---

## Log Format Examples

### Successful Request

```bash
================================================================================
[2025-10-21T12:34:56.789Z] POST /login
================================================================================
Request Body: {
  "userId": "farmer01"
}

[POST /login] Login attempt started
[POST /login] Authenticating user: farmer01
[POST /login] User authenticated, generating JWT...
[POST /login] ✅ Login successful for: farmer01 | Role: farmer
```

### Failed Request

```bash
================================================================================
[2025-10-21T12:35:10.123Z] POST /createProduct
================================================================================
Request Body: {
  "productName": "Tomatoes"
}
Authorization: Bearer eyJhbGciOiJIUzI...

[POST /createProduct] Product creation request
[POST /createProduct] User: farmer01 | Role: farmer
[POST /createProduct] ❌ Missing required fields
[POST /createProduct] ❌ Error: Missing required fields
[POST /createProduct] Stack: Error: Missing required fields
    at app.js:271:13
    ...
```

---

## Endpoint Logging Reference

### Public Endpoints

#### GET /status
```
[GET /status] Health check requested
```

#### GET /roles
```
[GET /roles] Fetching role definitions
[GET /roles] ✅ Retrieved 6 roles
```

#### POST /register
```
[POST /register] User registration attempt
[POST /register] Creating user: farmer01 with role: farmer
[POST /register] ✅ User registered. Total users: 1
```

#### POST /login
```
[POST /login] Login attempt started
[POST /login] Authenticating user: farmer01
[POST /login] User authenticated, generating JWT...
[POST /login] ✅ Login successful for: farmer01 | Role: farmer
```

---

### Protected Endpoints

#### POST /createProduct (Farmer, Admin)
```
[POST /createProduct] Product creation request
[POST /createProduct] User: farmer01 | Role: farmer
[POST /createProduct] Invoking blockchain transaction...
[POST /createProduct] ✅ Product created successfully
```

#### POST /updateLocation (Shipper, Distributor, Admin)
```
[POST /updateLocation] Location update request
[POST /updateLocation] User: shipper01 | Product: PROD-001
[POST /updateLocation] Invoking blockchain transaction...
[POST /updateLocation] ✅ Location updated
```

#### POST /transferOwnership (All Authenticated)
```
[POST /transferOwnership] Ownership transfer request
[POST /transferOwnership] From: farmer01 | To: manufacturer01 | Product: PROD-001
[POST /transferOwnership] Invoking blockchain transaction...
[POST /transferOwnership] ✅ Ownership transferred
```

#### POST /processProduct (Manufacturer, Admin)
```
[POST /processProduct] Product processing request
[POST /processProduct] User: manufacturer01 | Output: Processed Tomatoes
[POST /processProduct] Invoking blockchain transaction...
[POST /processProduct] ✅ Product processed
```

#### POST /addCertification (Manufacturer, Retailer, Admin)
```
[POST /addCertification] Add certification request
[POST /addCertification] User: manufacturer01 | Product: PROD-001 | Type: Organic
[POST /addCertification] Invoking blockchain transaction...
[POST /addCertification] ✅ Certification added
```

#### GET /getProduct/:productId
```
[GET /getProduct] Query product by ID
[GET /getProduct] User: farmer01 | Product: PROD-001
[GET /getProduct] Querying blockchain...
[GET /getProduct] ✅ Product retrieved
```

#### GET /getProductHistory/:productId
```
[GET /getProductHistory] Query product history
[GET /getProductHistory] User: farmer01 | Product: PROD-001
[GET /getProductHistory] Querying blockchain...
[GET /getProductHistory] ✅ History retrieved
```

#### GET /getProductsByOwner
```
[GET /getProductsByOwner] Query products by owner
[GET /getProductsByOwner] User: farmer01 | Owner: farmer01
[GET /getProductsByOwner] Querying blockchain...
[GET /getProductsByOwner] ✅ Products retrieved
```

---

## Error Tracking

### Authentication Errors

```bash
[POST /login] Login attempt started
[POST /login] Authenticating user: unknown_user
[POST /login] ❌ Authentication failed: User unknown_user not found in wallet
```

### Authorization Errors

If a user tries to access an endpoint they don't have permission for:
```bash
================================================================================
[2025-10-21T12:35:10.123Z] POST /createProduct
================================================================================

❌ ERROR HANDLER CAUGHT:
Message: Access denied. Required role(s): farmer, admin
Stack: Error: Access denied...
```

### Validation Errors

```bash
[POST /createProduct] Product creation request
[POST /createProduct] User: farmer01 | Role: farmer
[POST /createProduct] ❌ Missing required fields
```

### Blockchain Errors

```bash
[POST /createProduct] Invoking blockchain transaction...
[POST /createProduct] ❌ Error: Failed to invoke transaction createProduct: Error connecting to blockchain network
[POST /createProduct] Stack: Error: Failed to invoke transaction...
```

---

## How to Use Logs for Debugging

### 1. Start the Server
```bash
cd hlproject
npm start
```

### 2. Watch the Console

The console will show detailed logs for every request:

```bash
================================================================================
🚀 Product tracing server is running
📍 Port: 5000
🕐 Started at: 2025-10-21T12:30:00.000Z
================================================================================

================================================================================
[2025-10-21T12:34:56.789Z] GET /roles
================================================================================
[GET /roles] Fetching role definitions
[GET /roles] ✅ Retrieved 6 roles

================================================================================
[2025-10-21T12:35:10.123Z] POST /login
================================================================================
Request Body: {
  "userId": "farmer01"
}
[POST /login] Login attempt started
...
```

### 3. Track Request Flow

Each log shows the progression:
```
✅ [Endpoint] Request received
✅ [Endpoint] User authenticated
✅ [Endpoint] Validation passed
✅ [Endpoint] Calling blockchain...
✅ [Endpoint] Success!
```

Or if there's an error:
```
✅ [Endpoint] Request received
✅ [Endpoint] User authenticated
❌ [Endpoint] Validation failed: Missing productName
```

### 4. Identify Exact Error Location

Stack traces show exactly where errors occur:
```
[POST /createProduct] ❌ Error: Missing required fields
[POST /createProduct] Stack: Error: Missing required fields
    at app.js:271:13
    at Layer.handle [as handle_request] (/path/to/express/router/layer.js:95:5)
    ...
```

---

## Log Symbols

| Symbol | Meaning |
|--------|---------|
| ✅ | Success / Checkpoint passed |
| ❌ | Error / Failure |
| 📍 | Location information |
| 🚀 | Server started |
| 🕐 | Timestamp |
| `|` | Separator for related info |

---

## Common Debugging Scenarios

### Scenario 1: Login Not Working

**Watch for:**
```bash
[POST /login] Login attempt started
[POST /login] Authenticating user: farmer01
```

**If blockchain not set up:**
```bash
[POST /login] ❌ Error: User farmer01 not found in wallet
```

**Solution**: Set up Hyperledger Fabric and register users

---

### Scenario 2: JWT Token Issues

**Watch for:**
```bash
[POST /createProduct] Product creation request
```

**If no token:**
```bash
❌ ERROR HANDLER CAUGHT:
Message: No authorization token provided
```

**If token expired:**
```bash
❌ ERROR HANDLER CAUGHT:
Message: Token has expired
```

---

### Scenario 3: Permission Denied

**Watch for:**
```bash
[POST /processProduct] Product processing request
[POST /processProduct] User: farmer01 | Role: farmer
```

**If wrong role:**
```bash
❌ ERROR HANDLER CAUGHT:
Message: Access denied. Required role(s): manufacturer, admin
```

---

### Scenario 4: Blockchain Connection Failed

**Watch for:**
```bash
[POST /createProduct] Invoking blockchain transaction...
```

**If blockchain not running:**
```bash
[POST /createProduct] ❌ Error: Failed to connect to blockchain network
[POST /createProduct] Stack: Error: ECONNREFUSED...
```

---

## Testing with Logs

### Test 1: Health Check
```bash
curl http://localhost:5000/status
```

**Expected Log:**
```
[GET /status] Health check requested
```

### Test 2: Get Roles
```bash
curl http://localhost:5000/roles
```

**Expected Log:**
```
[GET /roles] Fetching role definitions
[GET /roles] ✅ Retrieved 6 roles
```

### Test 3: Login
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"userId": "farmer01"}'
```

**Expected Log:**
```
[POST /login] Login attempt started
[POST /login] Authenticating user: farmer01
[POST /login] User authenticated, generating JWT...
[POST /login] ✅ Login successful for: farmer01 | Role: farmer
```

---

## File Backup

The original `app.js` has been backed up to `app_backup.js`

To restore the original (without logs):
```bash
cd hlproject
cp app_backup.js app.js
```

To use the logged version (current):
```bash
cd hlproject
# Already active - no action needed
```

---

## Log Customization

You can customize log messages by editing `hlproject/app.js`:

**Find any log statement like:**
```javascript
console.log('[POST /login] Login attempt started');
```

**Modify to add more detail:**
```javascript
console.log('[POST /login] Login attempt started at', new Date().toLocaleString());
```

---

## Benefits

1. **Easy Debugging** - See exactly where code stops executing
2. **Error Tracking** - Full stack traces for all errors
3. **Request Monitoring** - Track all incoming requests
4. **Performance Insight** - See how long each step takes
5. **User Activity** - Monitor which users are doing what
6. **Blockchain Debugging** - Track blockchain transaction calls

---

## Summary

**Every endpoint now has comprehensive logging:**
- ✅ Request received logs
- ✅ Authentication/authorization logs
- ✅ Validation logs
- ✅ Processing step logs
- ✅ Success/failure logs
- ✅ Error messages with stack traces

**Start the server and watch the console to see everything that's happening!**

```bash
cd hlproject
npm start
```

Then make requests and watch the detailed logs flow in real-time.

# Penetration Testing Guide for Asset Tracker

## Overview

This document provides a comprehensive guide for penetration testing the Asset Tracker application. Use this guide to validate the security measures implemented and identify potential vulnerabilities.

## Prerequisites

- Access to a test environment (DO NOT test on production)
- Testing tools installed (Burp Suite, OWASP ZAP, curl, etc.)
- Valid test user credentials (both admin and regular user)
- Basic understanding of web security concepts

## Testing Methodology

Follow the OWASP Testing Guide v4 methodology:
1. Information Gathering
2. Configuration and Deployment Management Testing
3. Identity Management Testing
4. Authentication Testing
5. Authorization Testing
6. Session Management Testing
7. Input Validation Testing
8. Error Handling Testing
9. Cryptography Testing
10. Business Logic Testing

---

## 1. Authentication Testing

### 1.1 Test Username Enumeration

**Objective**: Verify that login errors don't reveal whether a username exists

**Test Steps**:
```bash
# Test with non-existent username
curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"username": "nonexistent", "password": "test"}'

# Test with existing username but wrong password
curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "wrongpassword"}'
```

**Expected Result**: Both should return the same generic error message ("Invalid username or password")

**Status**: ✓ Pass / ✗ Fail

---

### 1.2 Test Brute Force Protection

**Objective**: Verify that multiple failed login attempts are handled appropriately

**Test Steps**:
```bash
# Attempt 20 rapid login requests
for i in {1..20}; do
  curl -X POST http://localhost:3000/api/auth/callback/credentials \
    -H "Content-Type: application/json" \
    -d '{"username": "admin", "password": "wrong"}' &
done
wait
```

**Expected Result**: 
- ⚠️ Currently: No rate limiting (should be added for production)
- ✓ After implementing rate limiting: Requests should be throttled after 5-10 attempts

**Status**: ⚠️ Not Implemented (Rate limiting recommended)

---

### 1.3 Test Password Complexity

**Objective**: Verify that weak passwords are rejected

**Test Steps**:
```bash
# Try to create user with weak password
curl -X POST http://localhost:3000/api/user/addUser \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "123",
    "firstname": "Test",
    "lastname": "User",
    "email": "test@test.com"
  }'
```

**Expected Result**: Password should be rejected (minimum 8 characters based on validation schema)

**Status**: ✓ Pass / ✗ Fail

---

### 1.4 Test SQL Injection in Login

**Objective**: Verify protection against SQL injection attacks

**Test Steps**:
```bash
# Test SQL injection payloads
curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"username": "admin\" OR \"1\"=\"1", "password": "anything"}'

curl -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"username": "admin\"; DROP TABLE users; --", "password": "anything"}'
```

**Expected Result**: Login should fail, no SQL injection should occur

**Status**: ✓ Pass / ✗ Fail

---

## 2. Session Management Testing

### 2.1 Test Session Cookie Security

**Objective**: Verify that session cookies have secure flags

**Test Steps**:
```bash
# Login and inspect cookies
curl -v -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"username": "validuser", "password": "validpass"}' \
  -c cookies.txt

# Inspect cookies
cat cookies.txt
```

**Expected Result**: 
- Cookie should have `HttpOnly` flag (✓)
- Cookie should have `Secure` flag in production (✓)
- Cookie should have `SameSite=Lax` or `SameSite=Strict` (✓)

**Status**: ✓ Pass / ✗ Fail

---

### 2.2 Test Session Timeout

**Objective**: Verify that sessions expire appropriately

**Test Steps**:
1. Login and get session token
2. Wait for session timeout (30 days configured)
3. Try to access protected resource with expired token

**Expected Result**: Access should be denied after expiration

**Status**: ✓ Pass / ✗ Fail

---

### 2.3 Test Session Fixation

**Objective**: Verify protection against session fixation attacks

**Test Steps**:
1. Get a session token before login
2. Login with valid credentials
3. Check if session token changed after login

**Expected Result**: Session token should change after successful login

**Status**: ✓ Pass / ✗ Fail

---

## 3. Authorization Testing

### 3.1 Test Horizontal Privilege Escalation

**Objective**: Verify that users cannot access other users' resources

**Test Steps**:
```bash
# Login as User A
# Get User A's session token

# Try to access User B's profile
curl -X GET http://localhost:3000/api/user/{user_b_id} \
  -H "Cookie: next-auth.session-token={user_a_token}"

# Try to edit User B's profile
curl -X PUT http://localhost:3000/api/user/{user_b_id} \
  -H "Cookie: next-auth.session-token={user_a_token}" \
  -H "Content-Type: application/json" \
  -d '{"firstname": "Hacked"}'
```

**Expected Result**: Access should be denied (403 Forbidden)

**Status**: ✓ Pass / ✗ Fail

---

### 3.2 Test Vertical Privilege Escalation

**Objective**: Verify that regular users cannot access admin functions

**Test Steps**:
```bash
# Login as regular user
# Get regular user's session token

# Try to access admin-only endpoint
curl -X POST http://localhost:3000/api/manufacturer \
  -H "Cookie: next-auth.session-token={regular_user_token}" \
  -H "Content-Type: application/json" \
  -d '{"manufacturername": "Hacker Inc"}'

# Try to access admin dashboard
curl -X GET http://localhost:3000/admin \
  -H "Cookie: next-auth.session-token={regular_user_token}"
```

**Expected Result**: Access should be denied (403 Forbidden) and redirect to home

**Status**: ✓ Pass / ✗ Fail

---

### 3.3 Test Forced Browsing

**Objective**: Verify that unauthenticated access is blocked

**Test Steps**:
```bash
# Try to access protected pages without authentication
curl -X GET http://localhost:3000/assets
curl -X GET http://localhost:3000/user
curl -X GET http://localhost:3000/manufacturers
curl -X GET http://localhost:3000/api/asset
```

**Expected Result**: Should redirect to login page (for pages) or return 401 (for API)

**Status**: ✓ Pass / ✗ Fail

---

## 4. Input Validation Testing

### 4.1 Test XSS in Form Fields

**Objective**: Verify protection against Cross-Site Scripting

**Test Steps**:
```bash
# Try XSS in various fields
curl -X POST http://localhost:3000/api/manufacturer \
  -H "Cookie: next-auth.session-token={admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"manufacturername": "<script>alert(\"XSS\")</script>"}'

# Try XSS in user profile
curl -X PUT http://localhost:3000/api/user/{user_id} \
  -H "Cookie: next-auth.session-token={user_token}" \
  -H "Content-Type: application/json" \
  -d '{"firstname": "<img src=x onerror=alert(1)>"}'
```

**Expected Result**: 
- Input should be validated and rejected OR
- Output should be properly escaped when displayed

**Status**: ✓ Pass / ✗ Fail

---

### 4.2 Test Data Type Validation

**Objective**: Verify that invalid data types are rejected

**Test Steps**:
```bash
# Send string where number is expected
curl -X POST http://localhost:3000/api/asset \
  -H "Cookie: next-auth.session-token={admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "assetname": "Test",
    "assettag": "TAG001",
    "serialnumber": "SN001",
    "purchaseprice": "not-a-number"
  }'

# Send invalid UUID
curl -X GET http://localhost:3000/api/user/invalid-uuid \
  -H "Cookie: next-auth.session-token={user_token}"
```

**Expected Result**: Should return 400 Bad Request with validation error

**Status**: ✓ Pass / ✗ Fail

---

### 4.3 Test Field Length Limits

**Objective**: Verify that field length limits are enforced

**Test Steps**:
```bash
# Send overly long string
curl -X POST http://localhost:3000/api/manufacturer \
  -H "Cookie: next-auth.session-token={admin_token}" \
  -H "Content-Type: application/json" \
  -d "{\"manufacturername\": \"$(python -c 'print("A"*10000)')\"}"
```

**Expected Result**: Should return 400 Bad Request

**Status**: ✓ Pass / ✗ Fail

---

## 5. CSRF Testing

### 5.1 Test CSRF Protection

**Objective**: Verify that CSRF attacks are prevented

**Test Steps**:
1. Create malicious HTML page:
```html
<html>
<body>
<form action="http://localhost:3000/api/user/delete" method="POST">
  <input type="hidden" name="userId" value="victim-id" />
</form>
<script>document.forms[0].submit();</script>
</body>
</html>
```
2. Host the page on different origin
3. Login to app in one browser tab
4. Open malicious page in another tab

**Expected Result**: Request should be blocked due to CSRF protection

**Status**: ✓ Pass / ✗ Fail

---

## 6. Security Headers Testing

### 6.1 Test Security Headers Presence

**Objective**: Verify that security headers are configured

**Test Steps**:
```bash
curl -I http://localhost:3000/
```

**Expected Headers**:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

**Status**: ✓ Pass / ✗ Fail

---

### 6.2 Test Clickjacking Protection

**Objective**: Verify that the app cannot be embedded in iframe

**Test Steps**:
```html
<html>
<body>
<iframe src="http://localhost:3000/login"></iframe>
</body>
</html>
```

**Expected Result**: Page should not load in iframe (blocked by X-Frame-Options)

**Status**: ✓ Pass / ✗ Fail

---

## 7. Error Handling Testing

### 7.1 Test Error Message Disclosure

**Objective**: Verify that error messages don't reveal sensitive information

**Test Steps**:
```bash
# Trigger various errors
curl -X GET http://localhost:3000/api/user/nonexistent-id \
  -H "Cookie: next-auth.session-token={token}"

curl -X POST http://localhost:3000/api/asset \
  -H "Cookie: next-auth.session-token={token}" \
  -H "Content-Type: application/json" \
  -d '{invalid json}'
```

**Expected Result**: 
- Errors should be generic
- No stack traces in production
- No database error details exposed

**Status**: ✓ Pass / ✗ Fail

---

## 8. Business Logic Testing

### 8.1 Test Asset Assignment Logic

**Objective**: Verify that business rules are enforced

**Test Steps**:
```bash
# Try to assign asset to multiple users simultaneously
# Try to delete asset that's currently assigned
# Try to mark asset as available while assigned
```

**Expected Result**: Business rules should be enforced

**Status**: ✓ Pass / ✗ Fail

---

### 8.2 Test Permission Request Logic

**Objective**: Verify that only users with `canrequest` can request items

**Test Steps**:
```bash
# Login as user without canrequest permission
# Try to request an accessory
curl -X POST http://localhost:3000/api/accessory/request \
  -H "Cookie: next-auth.session-token={user_without_permission}" \
  -H "Content-Type: application/json" \
  -d '{"accessoryId": "some-id"}'
```

**Expected Result**: Request should be denied (403 Forbidden)

**Status**: ✓ Pass / ✗ Fail

---

## 9. Audit Logging Testing

### 9.1 Test Audit Log Creation

**Objective**: Verify that sensitive actions are logged

**Test Steps**:
1. Perform sensitive action (create user, delete asset, etc.)
2. Check audit logs as admin
3. Verify log contains:
   - User ID
   - Action
   - Entity affected
   - Timestamp
   - IP address

**Expected Result**: All sensitive actions should be logged

**Status**: ✓ Pass / ✗ Fail

---

### 9.2 Test Failed Login Logging

**Objective**: Verify that failed login attempts are logged

**Test Steps**:
1. Attempt login with wrong credentials
2. Check audit logs
3. Verify failed attempt is recorded

**Expected Result**: Failed login attempts should be logged with username and reason

**Status**: ✓ Pass / ✗ Fail

---

## 10. Automated Security Scanning

### 10.1 OWASP ZAP Scan

**Steps**:
```bash
# Install OWASP ZAP
# Run automated scan
zap-cli quick-scan --self-contained --start-options '-config api.disablekey=true' http://localhost:3000
```

**Review**: Check report for vulnerabilities

---

### 10.2 NPM Audit

**Steps**:
```bash
cd /path/to/project
npm audit
npm audit fix
```

**Review**: Check for vulnerable dependencies

---

### 10.3 Dependency Check

**Steps**:
```bash
# Install OWASP Dependency Check
dependency-check --project "Asset Tracker" --scan . --format HTML
```

**Review**: Check report for known vulnerabilities

---

## Testing Checklist

- [ ] All authentication tests passed
- [ ] All session management tests passed
- [ ] All authorization tests passed
- [ ] All input validation tests passed
- [ ] CSRF protection verified
- [ ] Security headers verified
- [ ] Error handling verified
- [ ] Business logic verified
- [ ] Audit logging verified
- [ ] Automated scans completed
- [ ] All critical/high vulnerabilities addressed
- [ ] Penetration test report documented

---

## Reporting Template

### Vulnerability Report

**Title**: [Brief description]

**Severity**: Critical / High / Medium / Low

**Description**: [Detailed description of the vulnerability]

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. ...

**Impact**: [What an attacker could do]

**Affected Components**: [URLs, files, endpoints]

**Proof of Concept**: [Code/screenshot]

**Recommended Fix**: [How to fix it]

**Status**: Open / In Progress / Fixed / Won't Fix

---

## Notes

- **DO NOT** test on production environment
- **ALWAYS** get written authorization before testing
- **RESPECT** rate limits and system resources
- **DOCUMENT** all findings
- **REPORT** critical vulnerabilities immediately
- **RETEST** after fixes are applied

---

Last Updated: 2024-01-27

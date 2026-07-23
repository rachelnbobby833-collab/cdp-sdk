# Executive Brief: JWT Authentication Utility

**Source File:** `python/cdp/auth/utils/jwt.py`  
**Module Area:** Authentication / Token Generation  
**Primary Role:** Generate signed JWTs for secure API and wallet-authenticated requests

---

## Executive Summary

This module is the Python SDK’s central utility for creating JSON Web Tokens (JWTs) used in authentication. It supports two related security flows:

- **Standard API authentication** for CDP service requests
- **Wallet authentication** for endpoints that require wallet-specific authorization

The file’s main value is that it standardizes token creation in one place. It validates inputs, parses supported private key formats, builds short-lived request-specific claims, and signs tokens using the correct cryptographic algorithm.

In practical terms, this module helps ensure that requests are authenticated consistently, securely, and with limited token reuse risk.

---

## Business Purpose

This module exists to make authenticated SDK requests both **secure** and **predictable**.

It does this by:
- ensuring every token is tied to a specific request target
- limiting the default lifetime of standard API tokens
- supporting more than one signing key format for flexibility
- encapsulating low-level cryptographic details behind a simple interface

This design reduces repeated authentication logic across the SDK and improves maintainability.

---

## What the Module Does

### 1. Validates input options
The module defines structured option models for both standard and wallet authentication flows. These models confirm that required request details are present and normalize HTTP methods before token generation begins.

### 2. Parses private keys
It supports multiple private key formats for standard API JWT creation:
- PEM-encoded EC private keys
- base64-encoded Ed25519 private keys

Wallet JWT generation uses a narrower format:
- base64-encoded DER EC private keys

### 3. Builds request-scoped claims
Both token types are bound to a specific API request using a URI-style claim based on:

`HTTP_METHOD host/path`

This makes each token more tightly scoped and reduces the likelihood of inappropriate reuse across unrelated requests.

### 4. Signs JWTs with the correct algorithm
The module automatically selects the signing algorithm for standard JWTs based on the parsed key type:
- EC key → `ES256`
- Ed25519 key → `EdDSA`

Wallet JWTs are always signed with:
- `ES256`

---

## Main Components

## `JwtOptions`
Used for standard API JWT creation.

**Captures:**
- API key ID
- API key secret
- request method
- request host
- request path
- optional expiration time

**Key point:**
This model ensures request information is normalized before signing begins.

---

## `WalletJwtOptions`
Used for wallet-auth JWT creation.

**Captures:**
- wallet authentication key
- request method
- request host
- request path
- request payload data

**Key point:**
This model allows wallet-auth tokens to optionally bind request payload contents in addition to the endpoint itself.

---

## `generate_jwt(options)`
Generates a standard API authentication token.

**High-level flow:**
1. validate required input fields
2. parse the provided signing key
3. determine the correct signing algorithm
4. create JWT headers including a nonce
5. create claims including validity timing and request binding
6. sign and return the token

**Executive takeaway:**
This is the primary utility for secure, short-lived, request-specific API authentication.

---

## `generate_wallet_jwt(options)`
Generates a wallet-authentication token.

**High-level flow:**
1. validate wallet key presence
2. build the request identifier
3. create claims for time, uniqueness, request URI, and optional request payload
4. decode and load the wallet private key
5. sign the token using `ES256`

**Executive takeaway:**
This function provides a more specialized authentication mechanism for wallet-protected operations.

---

## `_parse_private_key(key_data)`
Internal helper for interpreting API signing keys.

**Purpose:**
Abstracts away the complexity of accepting different key formats.

**Why it matters:**
It allows the public JWT generation path to remain simple while still supporting multiple cryptographic key types.

---

## `_generate_nonce()`
Internal helper that generates a 16-digit numeric nonce.

**Purpose:**
Adds uniqueness to the JWT header.

---

## Security Characteristics

This module includes several security-oriented design choices:

- **Request-bound tokens**  
  Tokens are scoped to a specific HTTP method and endpoint.

- **Short-lived standard tokens**  
  Standard JWTs default to a 120-second expiration window.

- **Algorithm selection by key type**  
  Standard API JWT creation supports both EC and Ed25519 keys.

- **Payload binding for wallet auth**  
  Wallet JWTs can include request data in the claims set.

- **Centralized validation and error handling**  
  Input validation and failures are handled consistently, simplifying callers.

---

## Operational Notes

From an engineering and platform perspective, this file is important because it:
- centralizes authentication behavior
- reduces duplicated signing logic across the SDK
- provides a clear boundary between application code and cryptographic implementation
- enables consistent token construction for downstream API calls

---

## Bottom Line

`python/cdp/auth/utils/jwt.py` is a focused authentication utility that turns request details and private keys into signed JWTs for secure API access.

Its main strengths are:
- clear separation of authentication concerns
- support for multiple signing key formats
- request-specific token scoping
- simple, reusable interfaces for the rest of the SDK

For executive audiences, the key point is simple: **this module is the SDK component responsible for securely packaging trust into each authenticated request.**

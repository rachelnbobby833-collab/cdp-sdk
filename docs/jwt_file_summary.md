# One-Page Summary: `python/cdp/auth/utils/jwt.py`

## Purpose
This file generates JSON Web Tokens (JWTs) for the Python SDK’s authentication layer. It supports:
- standard CDP API authentication
- wallet authentication for protected endpoints

## Core Components

### Data Models
- **`JwtOptions`**
  - stores API key ID, private key, request method, host, path, and expiration
  - validates request method and converts it to uppercase

- **`WalletJwtOptions`**
  - stores wallet auth key, request method, host, path, and request payload
  - validates request method and converts it to uppercase

### Main Functions
- **`generate_jwt(options)`**
  - creates JWTs for normal CDP API requests
  - supports:
    - EC keys with `ES256`
    - Ed25519 keys with `EdDSA`
  - includes claims for subject, issuer, audience, validity window, and request URI
  - adds a nonce to the JWT header

- **`generate_wallet_jwt(options)`**
  - creates JWTs for wallet-authenticated endpoints
  - signs with `ES256`
  - includes request URI, issued-at time, not-before time, unique token ID, and optional request payload

### Helper Functions
- **`_parse_private_key(key_data)`**
  - parses either:
    - PEM EC private keys
    - base64 Ed25519 keys

- **`_generate_nonce()`**
  - creates a 16-digit numeric nonce

## Key Behaviors
- tokens are **request-bound**, meaning they are valid only for a specific method and endpoint
- standard API JWTs are **short-lived** by default with a 120-second expiration
- wallet JWTs can also include request payload data in the token
- errors are surfaced as `ValueError`

## Overall Summary
This module is the SDK’s JWT utility layer. It handles input validation, key parsing, claim construction, and token signing so that API and wallet requests can be securely authenticated.

---

# Technical Report: `python/cdp/auth/utils/jwt.py`

## Table of Contents
1. Introduction
2. Purpose of the Module
3. Data Models
   1. `JwtOptions`
   2. `WalletJwtOptions`
4. JWT Generation Functions
   1. `generate_jwt`
   2. `generate_wallet_jwt`
5. Internal Helper Functions
   1. `_parse_private_key`
   2. `_generate_nonce`
6. Security and Design Characteristics
7. Conclusion

---

## 1. Introduction

The file `python/cdp/auth/utils/jwt.py` implements authentication helpers for the Python SDK. Its primary responsibility is generating signed JSON Web Tokens (JWTs) for secure communication with CDP-related API endpoints. The module supports both standard API authentication and wallet-specific authentication flows.

---

## 2. Purpose of the Module

The module centralizes JWT creation logic so that authentication is handled consistently across the SDK. It performs four major tasks:

1. validates request and key inputs
2. parses private keys in supported formats
3. constructs claims that bind a token to a specific request
4. signs the token using the appropriate cryptographic algorithm

This separation improves maintainability and ensures authentication logic remains reusable and consistent.

---

## 3. Data Models

### 3.1 `JwtOptions`

`JwtOptions` defines the fields required to generate a standard API JWT.

**Fields**
- `api_key_id`
- `api_key_secret`
- `request_method`
- `request_host`
- `request_path`
- `expires_in`

The model ensures that the HTTP method is valid and converts it to uppercase before use.

**Role**
This object packages the data needed for request-bound API authentication.

---

### 3.2 `WalletJwtOptions`

`WalletJwtOptions` defines the inputs required to generate a wallet-auth JWT.

**Fields**
- `wallet_auth_key`
- `request_method`
- `request_host`
- `request_path`
- `request_data`

Like `JwtOptions`, it validates and normalizes the HTTP method.

**Role**
This object packages the request information and payload data required for wallet-based authentication.

---

## 4. JWT Generation Functions

### 4.1 `generate_jwt`

This function generates JWTs for standard CDP API authentication.

**Processing steps**
1. verifies required fields are present
2. parses the private key using `_parse_private_key`
3. determines the signing algorithm:
   - EC private key → `ES256`
   - Ed25519 private key → `EdDSA`
4. builds a JWT header containing:
   - algorithm
   - key ID
   - type
   - nonce
5. builds claims containing:
   - subject
   - issuer
   - audience
   - not-before timestamp
   - expiration timestamp
   - request URI binding
6. signs and returns the encoded token

**Notable feature**
The token is bound to a request URI using the format:

`METHOD host/path`

This reduces token reuse across unrelated requests.

---

### 4.2 `generate_wallet_jwt`

This function generates JWTs for wallet-authenticated requests.

**Processing steps**
1. checks that the wallet authentication key exists
2. constructs the request URI
3. creates claims containing:
   - `uris`
   - `iat`
   - `nbf`
   - `jti`
   - optional `req`
4. decodes the wallet key from base64
5. loads the decoded bytes as a DER EC private key
6. signs the token with `ES256`

**Notable feature**
The optional `req` claim allows the token to be bound not only to the endpoint but also to request payload contents.

---

## 5. Internal Helper Functions

### 5.1 `_parse_private_key`

This helper interprets the private key material supplied to the standard JWT generator.

**Supported formats**
- PEM EC private key
- base64 Ed25519 private key

**Behavior**
- first attempts PEM parsing
- if unsuccessful, attempts base64 decoding
- for Ed25519 input, expects 64 bytes and uses the first 32 bytes as the seed
- raises a `ValueError` if parsing fails

This design allows a single API JWT generator to support multiple signing key types.

---

### 5.2 `_generate_nonce`

This helper creates a random 16-digit numeric string.

**Purpose**
The nonce is placed in the JWT header to add uniqueness to the token.

---

## 6. Security and Design Characteristics

This module has several notable design properties:

- **Request binding**  
  Tokens are scoped to a specific HTTP method and endpoint.

- **Short-lived standard tokens**  
  Standard JWTs expire after 120 seconds by default.

- **Multiple key support for API tokens**  
  Supports both EC and Ed25519 signing keys.

- **Wallet-specific signing flow**  
  Wallet JWT generation expects a base64-encoded DER EC private key and always uses `ES256`.

- **Structured validation**  
  Pydantic models validate method inputs before token generation begins.

- **Consistent error handling**  
  Most failures are re-expressed as `ValueError`, simplifying caller behavior.

---

## 7. Conclusion

`python/cdp/auth/utils/jwt.py` is a focused authentication utility module that creates signed, request-scoped JWTs for the SDK. It supports two related but distinct flows: standard API authentication and wallet authentication. By combining input validation, key parsing, claim generation, and signing in one module, it provides a clean and reusable foundation for secure authenticated requests.

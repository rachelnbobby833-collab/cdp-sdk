# Compliance Summary: JWT Authentication Utility

## Scope
This document summarizes the authentication responsibilities of `python/cdp/auth/utils/jwt.py`.

## Control Objectives
- validate authentication inputs before token generation
- generate signed JWTs using approved algorithms
- scope tokens to specific requests
- limit token lifetime for standard API authentication
- centralize security-sensitive signing behavior

## Key Security Behaviors
- request-bound `uris` claims
- default 120-second expiration for standard JWTs
- support for EC (`ES256`) and Ed25519 (`EdDSA`) where applicable
- wallet authentication support with request payload binding
- consistent exception handling through `ValueError`

## Risk Note
Because this module handles key parsing and token signing, changes should undergo security review.

# Board Brief: JWT Authentication Utility

## Purpose
This module generates signed JWTs used to authenticate SDK requests.

## Why It Matters
- centralizes authentication logic
- reduces security risk from duplicated token code
- binds tokens to specific requests
- supports secure API and wallet operations

## Key Value
- consistent token generation
- short-lived request-scoped access
- support for multiple signing key formats
- reusable trust layer for the SDK

## Executive Bottom Line
This component is the SDK control point for securely attaching trust to authenticated requests.

/**
 * Vercel Web Analytics integration for TypeDoc-generated documentation
 * This script is injected into all documentation pages via TypeDoc's customJs option
 */

import { inject } from '@vercel/analytics';

// Initialize Vercel Analytics
inject();

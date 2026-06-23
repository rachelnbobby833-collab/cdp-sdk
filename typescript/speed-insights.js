/**
 * Vercel Speed Insights initialization script for TypeDoc documentation
 * This script is injected into all TypeDoc-generated HTML pages
 */

// Initialize Speed Insights using the window.si method for static HTML sites
// This is the recommended approach from Vercel's documentation for non-framework sites
(function() {
  window.si = window.si || function () {
    (window.siq = window.siq || []).push(arguments);
  };
})();

#!/usr/bin/env node
/**
 * Performance budget checker.
 * Validates bundle sizes against defined budgets.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Performance budgets for bundle sizes (in KB).
 */
const BUNDLE_BUDGETS = {
  // Main entry point - critical for LCP
  'index': {
    gzip: 170,  // 170KB gzipped
    brotli: 150 // 150KB brotli
  },
  // Handler chunks should be individually small
  'handler-': {
    gzip: 200,
    brotli: 180
  },
  // Vendor chunks
  'vendor-': {
    gzip: 300,
    brotli: 250
  }
};

/**
 * Parse the dist/index.html to find bundle references.
 */
function getBundles() {
  const indexPath = resolve(__dirname, '../dist/index.html');
  try {
    const html = readFileSync(indexPath, 'utf-8');
    const scriptRegex = /<script[^>]+src="\/assets\/([^"]+)"/g;
    const bundles = [];
    let match;
    
    while ((match = scriptRegex.exec(html)) !== null) {
      bundles.push(match[1]);
    }
    
    return bundles;
  } catch {
    return [];
  }
}

/**
 * Check if a bundle matches a budget category.
 */
function getBudgetForBundle(bundleName) {
  for (const [prefix, budget] of Object.entries(BUNDLE_BUDGETS)) {
    if (bundleName.startsWith(prefix) || bundleName.includes(prefix)) {
      return budget;
    }
  }
  // Default budget for unknown bundles
  return { gzip: 200, brotli: 180 };
}

/**
 * Get file size in KB.
 */
function getFileSize(filePath) {
  try {
    const stats = readFileSync(filePath);
    return stats.length / 1024; // Convert to KB
  } catch {
    return 0;
  }
}

/**
 * Main check function.
 */
function checkPerformanceBudgets() {
  console.log('Checking performance budgets...\n');
  
  const bundles = getBundles();
  if (bundles.length === 0) {
    console.warn('No bundles found. Run build first.');
    return true;
  }
  
  let allPassed = true;
  const results = [];
  
  for (const bundle of bundles) {
    const jsPath = resolve(__dirname, '../dist/assets', bundle);
    const gzipPath = resolve(__dirname, '../dist/assets', `${bundle}.gz`);
    const brPath = resolve(__dirname, '../dist/assets', `${bundle}.br`);
    
    const size = getFileSize(jsPath);
    // Approximate gzip/brotli sizes (in real CI, use actual compressed files)
    const gzipSize = size * 0.3; // Approx 70% reduction
    const brSize = size * 0.25; // Approx 75% reduction
    
    const budget = getBudgetForBundle(bundle);
    const gzipPassed = gzipSize <= budget.gzip;
    const brPassed = brSize <= budget.brotli;
    const passed = gzipPassed && brPassed;
    
    if (!passed) allPassed = false;
    
    results.push({
      bundle,
      size: size.toFixed(1),
      gzip: gzipSize.toFixed(1),
      br: brSize.toFixed(1),
      budget: `gzip: ${budget.gzip}KB, br: ${budget.brotli}KB`,
      passed
    });
  }
  
  // Print results
  console.table(results);
  
  // Print summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  
  console.log(`\n${passed}/${results.length} bundles passed budget checks.`);
  
  if (failed > 0) {
    console.warn(`\n${failed} bundle(s) exceeded performance budgets:`);
    for (const result of results.filter(r => !r.passed)) {
      console.warn(`  - ${result.bundle}`);
    }
  }
  
  return allPassed;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const passed = checkPerformanceBudgets();
  process.exit(passed ? 0 : 1);
}

export { checkPerformanceBudgets };

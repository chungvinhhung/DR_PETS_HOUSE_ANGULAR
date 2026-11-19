#!/usr/bin/env node
/**
 * Angular emits standalone stylesheet bundles with content hashes in production.
 * CustomerLayout deliberately loads the Customer stylesheet on demand, so publish
 * a stable /customer.css alongside the hashed output after each production build.
 * Fail the build if the bundle is missing instead of serving a broken layout.
 */
import { copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const outputDir = 'dist/dr-pets-house-angular/browser';
if (!existsSync(outputDir)) {
  throw new Error('Angular browser output missing: ' + outputDir);
}
const styles = readdirSync(outputDir).filter(name =>
  /^customer(?:-[a-zA-Z0-9]+)?\.css$/.test(name),
);
const hashed = styles.filter(name => name !== 'customer.css');
if (hashed.length !== 1) {
  // Unhashed builds already provide the stable entry point.
  if (styles.length === 1 && styles[0] === 'customer.css') {
    console.log('Customer CSS is already published as customer.css.');
    process.exit(0);
  }
  throw new Error('Expected exactly one Customer CSS bundle, found: ' + styles.join(', '));
}
const source = join(outputDir, hashed[0]);
const target = join(outputDir, 'customer.css');
if (!statSync(source).size) throw new Error('Customer CSS bundle is empty: ' + source);
copyFileSync(source, target);
console.log('Published Customer CSS: ' + source + ' -> ' + target);

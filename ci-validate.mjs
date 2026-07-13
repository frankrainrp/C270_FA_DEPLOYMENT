// CI/CD Submission Validation Script
import fs from 'fs';

console.log('Validating Butler deployment package...');
const requiredFiles = [
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.db.yml',
  '.env.example',
  'src/routes/api/documents.js',
  'src/services/DocumentDecodeService.js',
];
const missing = requiredFiles.filter((file) => !fs.existsSync(file));
if (missing.length > 0) {
  console.error(`Validation failed. Missing: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('Validation passed. Required deployment files are present.');
process.exit(0);

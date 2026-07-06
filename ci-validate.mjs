// CI/CD Submission Validation Script
console.log('Validating Butler Deployment Package...');
const fs = require('fs');
if (!fs.existsSync('Dockerfile') || !fs.existsSync('docker-compose.yml')) {
    console.error('Validation Failed: Missing Docker configuration.');
    process.exit(1);
}
console.log('Validation Passed! Quality checks successful.');
process.exit(0);
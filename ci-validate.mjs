// CI/CD Submission Validation Script
import fs from 'fs';

console.log('Validating Butler Deployment Package...');

let failed = false;

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.error(`Validation Failed: Missing ${label || filePath}.`);
    failed = true;
  }
}

// --- Deployment configuration ---
requireFile('Dockerfile', 'Dockerfile');
requireFile('docker-compose.yml', 'docker-compose.yml');
requireFile('.env.example', '.env.example');

// --- Task 6 (Platform / Billing / QA): required files ---
requireFile('src/models/UserProfile.js', 'UserProfile model');
requireFile('src/services/UserProfileService.js', 'UserProfileService');
requireFile('src/routes/api/profile.js', 'Profile API route');
requireFile('src/routes/api/billing.js', 'Billing API route');
requireFile('src/views/settings.ejs', 'Settings view');
requireFile('src/views/billing.ejs', 'Billing view');
requireFile('src/views/pricing.ejs', 'Pricing view');
requireFile('src/public/js/settings.js', 'Settings client script');
requireFile('src/public/js/billing.js', 'Billing client script');
requireFile('src/public/js/pricing.js', 'Pricing client script');

// --- Login / signup via emailed OTP (n8n-backed): required files ---
requireFile('src/models/User.js', 'User model');
requireFile('src/models/OtpChallenge.js', 'OtpChallenge model');
requireFile('src/services/AuthService.js', 'AuthService');
requireFile('src/routes/api/auth.js', 'Auth API route');
requireFile('src/views/auth/login.ejs', 'Login view');
requireFile('src/public/js/auth-login.js', 'Login client script');

// --- Per-account data (tasks/notes/calendar/chat): required files ---
requireFile('src/middleware/requireAuth.js', 'requireAuth middleware');
requireFile('scripts/migrate-owner-email.js', 'ownerEmail migration script');

// --- Regression guard: cookie-parser is a declared dependency and must
// actually be wired into app.js, or the login session cookie can never
// be read back on subsequent requests. ---
const appJsPath = 'src/app.js';
if (fs.existsSync(appJsPath)) {
  const source = fs.readFileSync(appJsPath, 'utf8');
  const requiresCookieParser = /require\(["']cookie-parser["']\)/.test(source);
  const usesCookieParser = /app\.use\(\s*cookieParser\s*\(/.test(source);
  if (!requiresCookieParser || !usesCookieParser) {
    console.error('Validation Failed: cookie-parser is not wired into app.js (required to read the login session cookie).');
    failed = true;
  }
}

// --- Regression guard: .env.example must document the n8n OTP webhook
// so a fresh checkout doesn't silently fail to send login codes. ---
if (fs.existsSync('.env.example')) {
  const envExample = fs.readFileSync('.env.example', 'utf8');
  if (!envExample.includes('N8N_OTP_WEBHOOK_URL')) {
    console.error('Validation Failed: .env.example is missing N8N_OTP_WEBHOOK_URL.');
    failed = true;
  }
}

// --- Regression guard: every route module required in routes/index.js
// must also actually be mounted via app.use(...). This exact class of
// bug (imported but never mounted) previously left /api/tasks,
// /api/notes and /api/calendar silently 404ing in production. ---
const routesIndexPath = 'src/routes/index.js';
if (fs.existsSync(routesIndexPath)) {
  const source = fs.readFileSync(routesIndexPath, 'utf8');

  const importedNames = [...source.matchAll(/const\s+(\w+)\s*=\s*require\(["']\.\/api\//g)]
    .map((match) => match[1]);

  const mountedNames = new Set();
  for (const match of source.matchAll(/app\.use\(([^)]*)\)/g)) {
    const tokens = match[1].match(/\b[A-Za-z_]\w*\b/g) || [];
    tokens.forEach((token) => mountedNames.add(token));
  }

  const unmounted = importedNames.filter((name) => !mountedNames.has(name));
  if (unmounted.length > 0) {
    console.error(`Validation Failed: Route module(s) imported but never mounted in routes/index.js: ${unmounted.join(', ')}.`);
    failed = true;
  }
}

// --- Regression guard: Task/Note/CalendarEvent/ChatSession must each
// declare an ownerEmail field. Without it, per-account data isolation
// silently degrades back into one shared pool for every user. ---
const ownedModels = [
  ['src/models/Task.js', 'Task'],
  ['src/models/Note.js', 'Note'],
  ['src/models/CalendarEvent.js', 'CalendarEvent'],
  ['src/models/ChatSession.js', 'ChatSession'],
];
for (const [modelPath, label] of ownedModels) {
  if (fs.existsSync(modelPath)) {
    const source = fs.readFileSync(modelPath, 'utf8');
    if (!/ownerEmail\s*:/.test(source)) {
      console.error(`Validation Failed: ${label} model (${modelPath}) is missing an ownerEmail field.`);
      failed = true;
    }
  }
}

// --- Regression guard: the tasks/notes/calendar/chat API routes must
// require login (requireAuthApi) so one account's data is never served
// to a different (or logged-out) caller. ---
const guardedApiRoutes = [
  'src/routes/api/tasks.js',
  'src/routes/api/notes.js',
  'src/routes/api/calendar.js',
  'src/routes/api/chat.js',
];
for (const routePath of guardedApiRoutes) {
  if (fs.existsSync(routePath)) {
    const source = fs.readFileSync(routePath, 'utf8');
    const importsGuard = /requireAuthApi/.test(source) && /require\(["'].*middleware\/requireAuth["']\)/.test(source);
    const usesGuard = /requireAuthApi/.test(source) && /(router\.use\(\s*requireAuthApi|,\s*requireAuthApi\s*,)/.test(source);
    if (!importsGuard || !usesGuard) {
      console.error(`Validation Failed: ${routePath} does not require login via requireAuthApi.`);
      failed = true;
    }
  }
}

// --- Regression guard: the tasks/notes/calendar/chat/search PAGE routes
// must require login (requireAuthPage) too, or a logged-out visitor can
// still load the HTML shell for someone else's data. ---
const pagesPath = 'src/routes/pages.js';
if (fs.existsSync(pagesPath)) {
  const source = fs.readFileSync(pagesPath, 'utf8');
  const importsGuard = /requireAuthPage/.test(source) && /require\(["'].*middleware\/requireAuth["']\)/.test(source);
  const guardedPaths = ['/chat', '/chat/:id', '/search', '/tasks', '/notes', '/calendar'];
  const missing = guardedPaths.filter((path) => {
    const re = new RegExp(`router\\.get\\(\\s*["']${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']\\s*,\\s*requireAuthPage`);
    return !re.test(source);
  });
  if (!importsGuard || missing.length > 0) {
    console.error(`Validation Failed: pages.js is missing requireAuthPage on: ${missing.join(', ') || '(import missing)'}.`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log('Validation Passed! Quality checks successful.');
process.exit(0);

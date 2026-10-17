// Creates (or resets) an administrator account:  npm run create-admin
//
// The password is typed into this terminal, hashed, and only the hash is saved in
// the database. It never appears in any file, in the code, or in GitHub.
//
// To change an existing admin's password:  npm run create-admin -- --reset-password
import readline from 'node:readline';
import { AppError } from '../src/errors.js';
import { createDb } from '../src/db.js';
import { createAdminAccount } from '../src/services/admin.js';

try {
  process.loadEnvFile?.();
} catch {
  // no .env file
}

const databaseUrl = (process.env.DATABASE_URL || '').trim();
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.');
  process.exit(1);
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Like ask(), but the typed characters are not shown on screen
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: Boolean(process.stdin.isTTY)
    });
    let muted = false;
    const originalWrite = rl._writeToOutput?.bind(rl);
    if (originalWrite) {
      rl._writeToOutput = (text) => {
        if (!muted) originalWrite(text);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true; // the prompt text is already printed; hide what is typed next
  });
}

const resetPassword = process.argv.includes('--reset-password');
const env = process.env;

const email = env.NEW_ADMIN_EMAIL || (await ask('Admin email: '));
const name = env.NEW_ADMIN_NAME || (await ask('Display name (shown on the public status timeline): '));
const role =
  env.NEW_ADMIN_ROLE ||
  (await ask('Role - type "superadmin", or just press Enter for "campus_officer": ')) ||
  'campus_officer';

let password = env.NEW_ADMIN_PASSWORD;
if (!password) {
  password = await askHidden('Password (at least 12 characters, hidden while typing): ');
  const again = await askHidden('Repeat the password: ');
  if (again !== password) {
    console.error('The two passwords did not match. Nothing was saved.');
    process.exit(1);
  }
}

const db = createDb(databaseUrl);
try {
  const result = await createAdminAccount(db, { email, name, role, password, resetPassword });
  console.log(result.created ? `Admin account created for ${result.email}.` : `Password updated for ${result.email}.`);
} catch (err) {
  if (err instanceof AppError) {
    console.error(`Could not save the admin account: ${err.message}`);
    process.exitCode = 1;
  } else {
    console.error('Unexpected error:', err.message);
    process.exitCode = 1;
  }
} finally {
  await db.close();
}

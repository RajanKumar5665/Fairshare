// `npm run dev` from the repo root: starts the API (localhost:4000) and the app (localhost:5173) together.
// No extra packages needed. Ctrl+C stops both.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

for (const dir of ['backend', 'frontend']) {
  if (!existsSync(path.join(root, dir, 'node_modules'))) {
    console.error(`\n✖ ${dir}/node_modules missing. Run "npm run setup" first.\n`);
    process.exit(1);
  }
}
if (!existsSync(path.join(root, 'backend', '.env'))) {
  console.error('\n✖ backend/.env missing. Copy backend/.env.example to backend/.env and fill it in.\n');
  process.exit(1);
}

// Friendly hint if local MongoDB isn't running (the API would otherwise just crash).
await new Promise((resolve) => {
  const sock = createConnection({ host: '127.0.0.1', port: 27017 }, () => {
    sock.end();
    resolve();
  });
  sock.on('error', () => {
    console.warn('\n⚠ MongoDB is not reachable on localhost:27017. Start it (Windows: "net start MongoDB") unless MONGO_URI points elsewhere.\n');
    resolve();
  });
  sock.setTimeout(1500, () => sock.destroy(new Error('timeout')));
});

const colors = { api: '\x1b[36m', web: '\x1b[35m' };
const children = [];

function run(name, cwd) {
  // On Windows npm is a .cmd file, which needs a shell. Pass one command string (not args) to avoid Node's DEP0190 warning.
  const child =
    process.platform === 'win32'
      ? spawn(`${npm} run dev`, { cwd: path.join(root, cwd), shell: true, env: process.env })
      : spawn(npm, ['run', 'dev'], { cwd: path.join(root, cwd), env: process.env });
  const prefix = `${colors[name]}[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) out.write(prefix + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${prefix}stopped (exit ${code})`);
    shutdown(code ?? 0);
  });
  children.push(child);
}

let stopping = false;
function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
    else c.kill('SIGINT');
  }
  setTimeout(() => process.exit(code), 500);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('\nStarting FairShare locally…\n  API → http://localhost:4000\n  App → http://localhost:5173\n');
run('api', 'backend');
run('web', 'frontend');

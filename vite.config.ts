import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execFile } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

/** In `vite dev`, serve api/*.ts the way Vercel does, with keys read from .env (never sent to the browser). */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      try {
        for (const line of readFileSync(resolve(__dirname, '.env'), 'utf8').split('\n')) {
          const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
          if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
        }
      } catch {
        /* no .env: the agent and subscribe endpoints answer "not configured" */
      }
      server.middlewares.use('/api', async (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!/^[a-z-]+$/.test(name)) return next();
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const raw = Buffer.concat(chunks).toString('utf8');
        let body: unknown = raw;
        try {
          body = raw ? JSON.parse(raw) : undefined;
        } catch {
          /* handlers validate */
        }
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const shim = {
            setHeader: (k: string, v: string) => res.setHeader(k, v),
            status(code: number) {
              res.statusCode = code;
              return { json: (b: unknown) => (res.setHeader('content-type', 'application/json'), res.end(JSON.stringify(b))) };
            },
          };
          await mod.default({ method: req.method, body, headers: req.headers, socket: req.socket }, shim);
        } catch (e) {
          server.config.logger.error(String(e));
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, reason: 'dev_error' }));
        }
      });
    },
  };
}

/** Rebuild src/generated/content.json (with the examples) whenever a file under content/ or public/data changes. */
function contentWatcher(): Plugin {
  return {
    name: 'content-watcher',
    apply: 'serve',
    configureServer(server) {
      const dirs = [resolve(__dirname, 'content'), resolve(__dirname, 'public/data')];
      server.watcher.add(dirs);
      let timer: NodeJS.Timeout | undefined;
      const rebuild = (file: string) => {
        if (!dirs.some((d) => file.startsWith(d))) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          execFile('node', ['scripts/build-content.mjs', '--examples'], { cwd: __dirname }, (err, out, errOut) => {
            if (err) server.config.logger.error(errOut || String(err));
            else {
              server.config.logger.info(out.trim());
              server.ws.send({ type: 'full-reload' });
            }
          });
        }, 150);
      };
      server.watcher.on('change', rebuild);
      server.watcher.on('add', rebuild);
      server.watcher.on('unlink', rebuild);
    },
  };
}

/** Example data (public/data/examples) is for `npm run dev` only; keep it out of the production site. */
function dropExamples(): Plugin {
  return {
    name: 'drop-examples',
    apply: 'build',
    closeBundle() {
      rmSync(resolve(__dirname, 'dist/data/examples'), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  // `@/…` points at src/, the shadcn convention (so components pasted from shadcn or 21st.dev work unchanged).
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  plugins: [react(), tailwindcss(), devApi(), contentWatcher(), dropExamples()],
  server: { port: 5180 },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 2000 },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'api/**/*.test.ts'] },
} as never);

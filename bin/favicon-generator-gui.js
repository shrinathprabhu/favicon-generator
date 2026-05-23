#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';
import express from 'express';
import multer from 'multer';
import { generateFaviconAssets } from '../src/generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
const publicDir = path.join(rootDir, 'public');

let options;
try {
  options = parseServerArgs(process.argv.slice(2));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}

if (options.help) {
  printHelp();
  process.exit(0);
}

if (options.version) {
  console.log(packageJson.version);
  process.exit(0);
}

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

app.use(express.static(publicDir));

app.get('/healthz', (request, response) => {
  response.type('text/plain').send('ok');
});

app.post('/generate', upload.single('svg'), async (request, response, next) => {
  let tempRoot;

  try {
    const appName = String(request.body.appName ?? '').trim();
    const svgFile = request.file;

    if (!appName) {
      throw new Error('App name is required.');
    }

    if (!svgFile) {
      throw new Error('SVG file is required.');
    }

    if (path.extname(svgFile.originalname).toLowerCase() !== '.svg') {
      throw new Error('Only .svg files are supported.');
    }

    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'favicon-generator-'));
    const result = await generateFaviconAssets({
      svgText: svgFile.buffer.toString('utf8'),
      appName,
      outRoot: tempRoot,
      sourceName: svgFile.originalname
    });

    const zipName = `${result.appSlug}-favicon.zip`;
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    };

    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    response.on('finish', cleanup);
    response.on('close', cleanup);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (error) => {
      cleanup();
      if (response.headersSent) {
        response.destroy(error);
        return;
      }

      next(error);
    });

    archive.pipe(response);
    archive.directory(result.outDir, `${result.appSlug}-favicon`);
    await archive.finalize();
  } catch (error) {
    if (tempRoot) {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }

    next(error);
  }
});

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const message = error instanceof multer.MulterError ? multerMessage(error) : error.message;
  response.status(400).type('text/plain').send(message || 'Failed to generate favicon assets.');
});

const server = app.listen(options.port, options.host, () => {
  const url = `http://${options.host}:${options.port}`;
  console.log(`Favicon Generator GUI running at ${url}`);
  console.log('Open this URL in Chrome.');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${options.port} is already in use. Try --port ${options.port + 1}.`);
    process.exitCode = 1;
    return;
  }

  console.error(error.message);
  process.exitCode = 1;
});

function parseServerArgs(args) {
  const parsed = {
    host: '127.0.0.1',
    port: 5173,
    help: false,
    version: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    if (arg === '--version' || arg === '-v') {
      parsed.version = true;
      continue;
    }

    if (arg === '--host') {
      parsed.host = readValue(args, ++index, arg);
      continue;
    }

    if (arg.startsWith('--host=')) {
      parsed.host = arg.slice('--host='.length);
      continue;
    }

    if (arg === '--port' || arg === '-p') {
      parsed.port = parsePort(readValue(args, ++index, arg));
      continue;
    }

    if (arg.startsWith('--port=')) {
      parsed.port = parsePort(arg.slice('--port='.length));
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
}

function readValue(args, index, optionName) {
  const value = args[index];
  if (!value || value.startsWith('-')) {
    throw new Error(`${optionName} requires a value.`);
  }
  return value;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Port must be a number between 1 and 65535.');
  }

  return port;
}

function multerMessage(error) {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return 'SVG file is too large. Maximum size is 10 MB.';
  }

  return error.message;
}

function printHelp() {
  console.log(`favicon-generator-gui ${packageJson.version}

Start the local GUI server.

Usage:
  favicon-generator-gui [--host 127.0.0.1] [--port 5173]

Options:
  --host <host>      Hostname to bind. Defaults to 127.0.0.1.
  -p, --port <port>  Port to bind. Defaults to 5173.
  -h, --help         Show help.
  -v, --version      Show version.`);
}

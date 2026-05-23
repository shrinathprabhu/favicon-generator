#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATED_FILES, generateFaviconAssetsFromFile } from '../src/generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.resolve(__dirname, '..', 'package.json');
const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.version) {
    console.log(packageJson.version);
    return;
  }

  if (!options.input) {
    throw new Error('Missing SVG input. Use --input ./logo.svg or pass it as the first positional argument.');
  }

  if (!options.appName) {
    throw new Error('Missing app name. Use --app-name "My App" or pass it as the second positional argument.');
  }

  const result = await generateFaviconAssetsFromFile({
    inputPath: options.input,
    appName: options.appName,
    outRoot: options.outDir ?? process.cwd()
  });

  console.log(`Generated favicon assets in ${result.outDir}`);
  for (const file of GENERATED_FILES) {
    console.log(`- ${file}`);
  }
}

function parseArgs(args) {
  const options = {
    input: undefined,
    appName: undefined,
    outDir: undefined,
    help: false,
    version: false
  };
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--version' || arg === '-v') {
      options.version = true;
      continue;
    }

    if (arg === '--input' || arg === '-i') {
      options.input = readValue(args, ++index, arg);
      continue;
    }

    if (arg.startsWith('--input=')) {
      options.input = arg.slice('--input='.length);
      continue;
    }

    if (arg === '--app-name' || arg === '--name' || arg === '-n') {
      options.appName = readValue(args, ++index, arg);
      continue;
    }

    if (arg.startsWith('--app-name=')) {
      options.appName = arg.slice('--app-name='.length);
      continue;
    }

    if (arg.startsWith('--name=')) {
      options.appName = arg.slice('--name='.length);
      continue;
    }

    if (arg === '--out' || arg === '--output' || arg === '-o') {
      options.outDir = readValue(args, ++index, arg);
      continue;
    }

    if (arg.startsWith('--out=')) {
      options.outDir = arg.slice('--out='.length);
      continue;
    }

    if (arg.startsWith('--output=')) {
      options.outDir = arg.slice('--output='.length);
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positionals.push(arg);
  }

  options.input ??= positionals[0];
  options.appName ??= positionals[1];
  return options;
}

function readValue(args, index, optionName) {
  const value = args[index];
  if (!value || value.startsWith('-')) {
    throw new Error(`${optionName} requires a value.`);
  }
  return value;
}

function printHelp() {
  console.log(`favicon-generator ${packageJson.version}

Generate favicon.ico, PNG app icons, platform assets, metadata, and SVG copies from an SVG source.

Usage:
  favicon-generator --input ./logo.svg --app-name "My App" [--out ./public]
  favicon-generator ./logo.svg "My App" --out ./public

Options:
  -i, --input <file>       Source SVG file. Required.
  -n, --app-name <name>    App name used for the output folder and manifest. Required.
  -o, --out <directory>    Parent output directory. Defaults to the current directory.
  -h, --help               Show help.
  -v, --version            Show version.

Output:
  <appname>-favicon/
    favicon.ico
    favicon.svg
    original.svg
    favicon-16x16.png
    favicon-32x32.png
    favicon-48x48.png
    favicon-64x64.png
    favicon-128x128.png
    favicon-256x256.png
    apple-touch-icon.png
    android-chrome-192x192.png
    android-chrome-512x512.png
    mstile-150x150.png
    site.webmanifest
    browserconfig.xml
    html-tags.txt`);
}

# Favicon Generator

A simple sharp wrapper that generates favicon for your apps with a single SVG

Canonical URL: <https://lowkey.tools/favigen>

GitHub: <https://github.com/shrinathprabhu/favicon-generator>

From the makers of [OwlEye Analytics](https://owleye.dev)

## Install

```sh
git clone https://github.com/shrinathprabhu/favicon-generator.git
cd favicon-generator
npm install
```

## CLI

```sh
npm run cli -- --input ./logo.svg --app-name "My App"
```

You can also pass the image file and app name as positional arguments:

```sh
npm run cli -- ./logo.svg "My App" --out ./public
```

After installing or linking the package globally:

```sh
favicon-generator ./logo.svg "My App" --out ./public
```

CLI options:

- `-i, --input <file>`: source image file. SVG is the recommended input.
- `-n, --app-name <name>`: app name used for the output folder and manifest. Required.
- `-o, --out <directory>`: parent output directory. Defaults to the current directory.
- `-h, --help`: show help.
- `-v, --version`: show version.

Supported formats: `.svg`, `.png`, `.webp`, `.jpg`, `.jpeg`, `.avif`, `.gif`, `.bmp`, `.ico`, `.tiff`.

## GUI

Start the local GUI server:

```sh
npm run gui
```

Open this URL in Chrome:

```text
http://127.0.0.1:5173
```

The canonical local route is also available:

```text
http://127.0.0.1:5173/favigen
```

Pick an image, enter an app name, and the browser downloads a ZIP containing the generated `<appname>-favicon` folder.

You can change the port:

```sh
npm run gui -- --port 5174
```

## Deploy on Vercel

This repo includes `vercel.json` for Vercel static hosting. The Vercel project should use:

- Framework preset: Other
- Build command: leave empty
- Output directory: `public`
- Install command: default

Deploy with the Vercel CLI:

```sh
vercel
vercel --prod
```

The Vercel config serves the app at `/` and also rewrites `/favigen` plus `/favigen/*` to the static files in `public`, so it can sit behind the `lowkey.tools/favigen` proxy rewrite.

For SEO discovery on the parent domain, keep the root `lowkey.tools` sitemap and robots configuration aware of `https://lowkey.tools/favigen`.

## Generated Files

Assets are written into a single folder named `<appname>-favicon`. App names are slugified for filesystem safety, so `"My App"` becomes `my-app-favicon`.

Generated files:

- `favicon.ico`
- `favicon.svg`
- `original.svg`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `favicon-48x48.png`
- `favicon-64x64.png`
- `favicon-128x128.png`
- `favicon-256x256.png`
- `apple-touch-icon.png`
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`
- `mstile-150x150.png`
- `site.webmanifest`
- `browserconfig.xml`
- `html-tags.txt`

PNG outputs use transparent padding for non-square SVGs, Lanczos resizing, alpha preservation, and size-aware sharpening.

## Site Metadata

The static GUI includes canonical tags, Open Graph tags, Twitter summary tags, JSON-LD, `robots.txt`, `sitemap.xml`, `llms.txt`, `humans.txt`, a web manifest, and simple light/dark favicon assets.

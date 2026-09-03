# Favicon Generator

A simple tool that generates favicon.ico, PNG app icons, platform assets, and web metadata from an SVG, PNG, WebP, or other image formats.

## Install

```sh
npm install
```

## CLI

```sh
npm run cli -- --input ./logo.svg --app-name "My App"
# Or with a PNG/WebP:
npm run cli -- --input ./logo.png --app-name "My App"
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

- `-i, --input <file>`: source image file (SVG, PNG, WebP, JPEG, etc.). Required.
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

Pick an SVG, enter an app name, and the browser downloads a ZIP containing the generated `<appname>-favicon` folder.

You can change the port:

```sh
npm run gui -- --port 5174
```

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

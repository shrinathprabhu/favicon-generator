# Favicon Generator

A simple sharp wrapper that generates favicon for your apps with a single SVG

Canonical URL: <https://favigen.lowkey.tools/>

GitHub: <https://github.com/shrinathprabhu/favicon-generator>

From the makers of [OwlEye Analytics](https://owleye.dev)

Made by [Shrinath Prabhu](https://shrinath.me). Follow [@shrinath_prabhu on X](https://x.com/shrinath_prabhu).

Explore the rest of [lowkey.tools](https://lowkey.tools). Working on the rest of your project? Settle into a focus session with [SuperFocus](https://superfocus.lowkey.tools/).

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

## Web Tools

The site has three tools that share the same look and navigation:

- **Favicon** (`/`): generates the favicon bundle described below.
- **OG Image** (`/og-image/`): designs a 1200x630 (1.91:1) social share image without AI. Fill in a title and optional description, eyebrow, brand, footer, and website, then choose a layout (Spotlight, Centered, Split, Editorial), a theme, a background (solid, gradient, glow, aurora), a grid or dot pattern, and any [Fontsource](https://fontsource.org/) font with weight, size, letter spacing, and line height. Add a logo or use a monogram. Export PNG, JPG, or SVG. PNG defaults to a compact 256-color encoding (usually under 100 KB, versus around 600 KB from the browser's own encoder); switch to lossless when you need exact pixels. SVG can embed its fonts. The design is saved in the browser.
- **Meta Tags** (`/meta-tags/`): enter a URL to read its title, description, canonical, Open Graph, and X tags. Edit them and see live previews for Google, X, Facebook, LinkedIn, and Slack, with character and Google pixel-width limits and checks for image size. A tag checklist marks each required, recommended, and optional tag as on the page, missing, or added by the generated code. A favicon section shows the icon in light and dark browser tabs, at 16/32/48px, and on the iOS home screen, and lists every icon the page declares. Copy the result as HTML or a Next.js `metadata` export.

The hosted site cannot reach `localhost`. For local pages, the Meta Tags tool first tries fetching directly from your browser (this works if the dev server allows CORS). If that fails, it offers a "Send to Meta Tags" bookmarklet, a paste-HTML option, or the local GUI below, whose `/api/meta` route can fetch localhost pages.

## GUI

Start the local GUI server:

```sh
npm run gui
```

Open this URL in Chrome:

```text
http://127.0.0.1:5173
```

Pick an image, enter an app name, and the browser downloads a ZIP containing the generated `<appname>-favicon` folder. The OG Image and Meta Tags tools are at `/og-image/` and `/meta-tags/`.

You can change the port:

```sh
npm run gui -- --port 5174
```

## Deploy on Cloudflare Workers

Deploy this app with **Workers Static Assets**. In Cloudflare, create a Worker, connect this Git repository, and use these Workers Builds settings:

| Setting | Value |
| --- | --- |
| Worker name | `favigen` (matches `wrangler.jsonc`) |
| Custom domain | `favigen.lowkey.tools` (managed by `wrangler.jsonc`) |
| Production branch | Your release branch |
| Build command | Leave empty (no build step) |
| Deploy command | `npx wrangler@4 deploy` |
| Non-production branch deploy command | `npx wrangler@4 versions upload` |
| Assets directory | `./public` (set in `wrangler.jsonc`) |
| Root directory | Leave empty (repository root) |
| Build environment variable | `SKIP_DEPENDENCY_INSTALL=1` |

The deployable site is already in `public`. The favicon and OG image tools run entirely in the browser, so no Node runtime or server-side Sharp service is needed. A small Worker script (`src/worker.js`) handles only `/api/meta`, which the Meta Tags tool uses to read the `<head>` of public pages; it has no dependencies, and Wrangler bundles it during deploy. Every other path is served straight from static assets (`run_worker_first: ["/api/*"]`). The build variable skips installing the app's CLI dependencies; the deploy command downloads Wrangler when needed.

`wrangler.jsonc` configures `assets.directory` for Workers Static Assets. `public/_headers` supplies the security and cache headers, and `assets.not_found_handling: "404-page"` serves `public/404.html` for unknown paths. HTML routing normalizes `/index.html` to `/`.

For a local Workers preview using Wrangler:

```sh
npx wrangler@4 dev
```

Validate deployment configuration without publishing:

```sh
npx wrangler@4 deploy --dry-run
```

Deploy directly from the CLI:

```sh
npx wrangler@4 login
npx wrangler@4 deploy
```

Wrangler reads the Worker name and assets directory from `wrangler.jsonc`. If you choose another Worker name, update `name` in that file to match. `wrangler deploy` publishes to the configured Worker regardless of your local Git branch. Use `wrangler versions upload` for a preview version, or Workers Builds for automatic deployments from your configured production branch.

`wrangler.jsonc` declares `favigen.lowkey.tools` in `routes` with `custom_domain: true`. On deployment, Cloudflare attaches the domain and provisions its DNS record and TLS certificate; there is no separate dashboard setup step. Deploy to the Cloudflare account with the active `lowkey.tools` zone and permissions to manage the Worker and its custom domain. If the hostname still has a CNAME for another host, remove that conflicting record when you are ready to switch traffic, then deploy.

The `workers.dev` hostname and version preview URLs remain enabled for testing. For an open-source fork, replace the Worker name and custom domain with your own before deploying, or remove `routes` to use only `workers.dev`.

All canonical metadata continues to use `https://favigen.lowkey.tools/`, with discovery files at `/robots.txt`, `/sitemap.xml`, and `/llms.txt`. Submit `https://favigen.lowkey.tools/sitemap.xml` to search engines, and point the Favigen listing on `lowkey.tools` to the subdomain.

References: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [build environment](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/), [custom headers](https://developers.cloudflare.com/workers/static-assets/headers/), [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

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

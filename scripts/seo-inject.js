#!/usr/bin/env node
/**
 * One-time SEO injection script.
 * Reads projects.json and injects meta tags + JSON-LD into each project page.
 *
 * Usage: node scripts/seo-inject.js [--base-url https://example.com/Congressional-Showcase/]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let baseUrl = 'https://hackclub.github.io/Congressional-Showcase/';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base-url' && args[i + 1]) {
    baseUrl = args[i + 1].replace(/\/?$/, '/');
    i++;
  }
}

const root = path.resolve(__dirname, '..');
const projects = JSON.parse(fs.readFileSync(path.join(root, 'projects.json'), 'utf8'));

let modified = 0;
let skipped = 0;

for (const project of projects) {
  const filePath = path.join(root, 'sites', project.slug, 'index.html');

  if (!fs.existsSync(filePath)) {
    console.log(`SKIP (not found): ${filePath}`);
    skipped++;
    continue;
  }

  let html = fs.readFileSync(filePath, 'utf8');

  // Idempotent: skip if already injected
  if (html.includes('og:title')) {
    console.log(`SKIP (already has OG): sites/${project.slug}/index.html`);
    skipped++;
    continue;
  }

  const pageUrl = `${baseUrl}sites/${project.slug}/`;
  const ogImage = `${baseUrl}assets/images/og-default.png`;
  const title = `${project.appName} | ${project.name}`;
  const desc = project.description;
  const metaDesc = `${project.appName} by ${project.name} (${project.district}) - ${desc} Congressional App Challenge 2025.`;

  const seoMeta = `
  <meta name="description" content="${escapeAttr(metaDesc)}">
  <meta property="og:title" content="${escapeAttr(title)} - Congressional App Challenge">
  <meta property="og:description" content="${escapeAttr(desc)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="Congressional App Challenge Showcase">
  <meta property="og:image" content="${ogImage}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeAttr(title)} - Congressional App Challenge">
  <meta name="twitter:description" content="${escapeAttr(desc)}">
  <meta name="twitter:image" content="${ogImage}">
  <link rel="canonical" href="${pageUrl}">
  <link rel="manifest" href="../../manifest.json">`;

  const jsonLd = `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "name": ${JSON.stringify(title)},
        "description": ${JSON.stringify(desc)},
        "url": ${JSON.stringify(pageUrl)},
        "isPartOf": {
          "@type": "WebSite",
          "name": "Congressional App Challenge Showcase",
          "url": ${JSON.stringify(baseUrl)}
        }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Showcase",
            "item": ${JSON.stringify(baseUrl)}
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": ${JSON.stringify(title)},
            "item": ${JSON.stringify(pageUrl)}
          }
        ]
      }
    ]
  }
  </script>`;

  // Insert meta tags after </title>
  const titleClose = '</title>';
  const titleIdx = html.indexOf(titleClose);
  if (titleIdx === -1) {
    console.log(`SKIP (no </title>): sites/${project.slug}/index.html`);
    skipped++;
    continue;
  }
  html = html.slice(0, titleIdx + titleClose.length) + seoMeta + html.slice(titleIdx + titleClose.length);

  // Insert JSON-LD before </head>
  const headClose = '</head>';
  const headIdx = html.indexOf(headClose);
  if (headIdx === -1) {
    console.log(`SKIP (no </head>): sites/${project.slug}/index.html`);
    skipped++;
    continue;
  }
  html = html.slice(0, headIdx) + jsonLd + '\n' + html.slice(headIdx);

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`DONE: sites/${project.slug}/index.html`);
  modified++;
}

console.log(`\nFinished: ${modified} modified, ${skipped} skipped.`);

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

# gh-pages

The website for [Style Guide Archives](https://github.com/WPTK/style-guide-archives). This branch holds only the site.

- `_data/guides.json` lists the guides. It is generated; do not edit it by hand.
- `guides.json` is the same list served to the page. `index.html` carries only the first 100 rows; `assets/js/list.js` draws the other pages from `guides.json`.
- Built by GitHub Pages' Jekyll (the `github-pages` gem set).
- `pdfjs/` is the prebuilt [PDF.js](https://github.com/mozilla/pdf.js) viewer, release 6.5.438, without its source maps and sample PDF. GitHub serves the guides as `application/octet-stream`, which browsers download, so the list links each PDF through `pdfjs/web/viewer.html?file=<url>`. The local edits must be redone after an upgrade. Upstream zip `pdfjs-6.5.438-dist.zip`, sha256 `fcbe9ba21d9911843e3502adc178a7f549a524a4055f887bedc942e5490c6ba1`; `build/` matches it apart from the removed source maps, and only these files in `web/` differ:
  - `viewer.mjs`: `defaultUrl` is empty; `validateFileURL` accepts only `.pdf` files, from the WPTK `style-guide-archives-*` repositories or the viewer's own origin; `enableScripting` is `false`; `externalLinkTarget` is `2` (links in a PDF open in a new tab); `_documentError` shows `#sgaError`.
  - `viewer.html`: the `#sgaError` message with a link back to the list.
  - `viewer.css`: the `#sgaError` rules at the end.

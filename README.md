# gh-pages

The website for [Style Guide Archives](https://github.com/WPTK/style-guide-archives). This branch holds only the site.

- `_data/guides.json` lists the guides. It is generated, so regenerate it rather than editing it.
- `guides.json` is the same list served to the page. `index.html` carries only the first 100 rows; `assets/js/list.js` draws the other pages from `guides.json`.
- Built by GitHub Pages' Jekyll (the `github-pages` gem set).
- `pdfjs/` is the prebuilt [PDF.js](https://github.com/mozilla/pdf.js) viewer, release 6.5.438, without its source maps and sample PDF. GitHub serves the guides as `application/octet-stream`, which browsers download, so the list links each PDF through `pdfjs/web/viewer.html?file=<url>`. Two edits in `pdfjs/web/viewer.mjs` must be redone after an upgrade: `defaultUrl` is empty, and `validateFileURL` accepts files from the WPTK `style-guide-archives-*` repositories.

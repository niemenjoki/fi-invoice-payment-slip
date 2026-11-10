# Changelog

## 1.0.2 - 2026-11-10

- README: the first example writes the PDF to a file (`doc.pipe(fs.createWriteStream(...))`).
- README: the package is an ES module only; how to use it from CommonJS.
- No code changes.

## 1.0.1 - 2026-11-10

- The npm package includes CHANGELOG.md.
- Published from GitHub Actions with npm provenance.

## 1.0.0 - 2026-11-10

First public release.

- Finnish credit transfer form (tilisiirto) for PDFKit, 210 x 101.6 mm, labels in Finnish and Swedish or English.
- Finnish reference numbers and RF creditor references: create, validate and format.
- Bank bar code versions 4 and 5 (virtuaaliviivakoodi) drawn as Code 128 C.
- QR code for mobile bank apps (Finance Finland 2015 guideline, EPC069-12).
- Tested against the examples in Finance Finland's guides. The bar code was read correctly by OP Mobile.

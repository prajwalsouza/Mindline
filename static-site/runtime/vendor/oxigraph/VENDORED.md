# Oxigraph browser runtime

Pinned upstream package: `oxigraph@0.5.11`, from https://www.npmjs.com/package/oxigraph and https://github.com/oxigraph/oxigraph/tree/v0.5.11/js.

`web.mjs` is the unmodified npm `web.js` with its extension changed for static ES-module serving. `web_bg.wasm` is the matching unmodified npm binary. The package tarball SHA-1 is `72fd7ee8dc7fedcc817842979eaf26084a3e25ee` (npm metadata). README and package metadata are retained. MIT and Apache-2.0 license texts are from the upstream v0.5.11 tag.

The worker loads these files from the same static site. No CDN, API, remote RDF graph, or external runtime service is used. Knowledge queries execute the bundled allowlisted SPARQL templates against locally constructed RDF triples. Private patient note text is excluded from that projection.

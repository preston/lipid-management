# Lipid Management



## Quick Start with Docker

The easiest way to run this application is using Docker:

### Build and Run with Docker

```bash
# Build the Docker image
docker build -t p3000/lipid-management:latest .

# Alternatively, build images for multiple architectures if supported by your build environment
docker buildx build --platform linux/arm64,linux/amd64 -t p3000/lipid-management:latest .

# Run the container
docker run -p 4200:80 -e "LIPID_MANAGEMENT_FHIR_BASE_URL=http://localhost:8080/fhir" p3000/lipid-management:latest
```

Once the container is running, open your browser and navigate to `http://localhost:4200/`.


## Running from Source Code

### Prerequisites

- Current stable version of Node.js
- npm (comes with Node.js)

### Development Server

To start a local development server, run:

```bash
# Install dependencies
npm install

# Start the development server
npm run start
```

Runtime configuration is loaded from `public/configuration.js` (Docker substitutes env vars via `configuration.template.js`). Key window settings:

- `LIPID_MANAGEMENT_FHIR_BASE_URL` — FHIR server for standalone Patient search / `$evaluate`
- `LIPID_MANAGEMENT_VSAC_*` — optional VSAC/CTS credentials in Settings (not required to run the app)
- `LIPID_MANAGEMENT_SMART_CLIENT_ID` / `LIPID_MANAGEMENT_SMART_REDIRECT_URI` — SMART-on-FHIR launch

Users can override these in the in-app **Settings** page (browser local storage).

### ValueSets

Canonical ValueSets live under `public/value-sets/` and are loaded onto the FHIR server via the in-app Loader.

| Origin | Meaning |
|---|---|
| **VSAC** | Committed expansions of NLM CTS ValueSets with original VSAC metadata (publisher, purpose, CTS URL). Refresh with a one-off CTS `$expand` + metadata fetch when upstream changes. |
| **ASU** | Custom composes maintained in this repo (`publisher: ASU CDS`) for LOINC/RxNorm observations, therapy flags, and hybrid PREVENT criteria. |

Loader labels each pack as VSAC or ASU. CQL references VSAC packs by their CTS `ValueSet.url` and ASU packs by `https://asu.edu/fhir/ValueSet/...`.

## License and Attribution

Source code and algorithm implementations provided under the terms of the Apache 2.0 open source license. Copyright © 2026 Preston Lee. All rights reserved.

**OpenCVDRisk** cardiovascular disease risk scoring utilities are intended to align with those of the American Heart Association's (AHA) PREVENT™ cardiovascular risk algorithms, but do not use AHA source code nor any AHA assets requiring license from AHA. This is not an official AHA product and is neither affiliated with nor endorsed by the AHA, and is based purely on publicly published materials.

Statistical model: Khan SS et al., Circulation. 2024;149:430-449. DOI: [10.1161/CIRCULATIONAHA.123.067626](https://doi.org/10.1161/CIRCULATIONAHA.123.067626).

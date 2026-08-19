# Lipid Management

[![Build Status](https://ci.prestonlee.com/api/badges/preston/lipid-management/status.svg)](https://ci.prestonlee.com/preston/lipid-management)

## Quick Start with Docker

The easiest way to run this application is using Docker:

### Build and Run with Docker

```bash
# Build the Docker image
docker build -t p3000/lipid-management:latest .

# Alternatively, build images for multiple architectures if supported by your build environment
docker buildx build --platform linux/arm64,linux/amd64 -t p3000/lipid-management:latest .

# Run the pre-build Lipid Management application
docker run -p 4200:80 -e "LIPID_MANAGEMENT_FHIR_BASE_URL=http://localhost:8080/fhir" p3000/lipid-management:latest

# Also run a HAPI FHIR JPA server, if you need a "CQL with FHIR" execution engine.
# Here is an example configuration with "Clinical Reasoning Module" enabled.
docker run -d --name hapi-r4-data -p 8080:8080 \                                                                           
 -e "hapi.fhir.fhir_version=R4" \
 -e "spring.main.allow-bean-definition-overriding=true" \
 -e "hapi.fhir.expunge_enabled=true" \
 -e "hapi.fhir.allow_multiple_delete=true" \
 -e "hapi.fhir.bulk_export_enabled=true" \
 -e "hapi.fhir.bulk_import_enabled=true" \
 -e "hapi.fhir.enable_index_missing_fields=true" \
 -e "hapi.fhir.cdshooks.enabled=true" \
 -e "hapi.fhir.cr.enabled=true" \
 -e "spring.jpa.properties.hibernate.search.enabled=true" \
 -e "spring.jpa.properties.hibernate.search.backend.type=lucene" \
 -e "spring.jpa.properties.hibernate.search.backend.analysis.configurer=ca.uhn.fhir.jpa.search.HapiHSearchAnalysisConfigurers\$HapiLuceneAnalysisConfigurer" \
 -e "HAPI_FHIR_ALLOW_EXTERNAL_REFERENCES=true" \
 -e "hapi.fhir.cr.cql.terminology.valueset_preexpansion_mode=USE_IF_PRESENT" \
 -e "hapi.fhir.cr.cql.terminology.valueset_expansion_mode=PERFORM_NAIVE_EXPANSION" \
 -e "hapi.fhir.cr.cql.terminology.valueset_membership_mode=USE_EXPANSION" \
 -e "hapi.fhir.cr.cql.terminology.code_lookup_mode=USE_VALIDATE_CODE_OPERATION" \
 -e "hapi.fhir.cr.cql.data.search_parameter_mode=USE_SEARCH_PARAMETERS" \
 -e "hapi.fhir.cr.cql.data.terminology_parameter_mode=FILTER_IN_MEMORY" \
 -e "hapi.fhir.cr.cql.data.profile_mode=DECLARED" \
 -e "hapi.fhir.pre_expand_value_sets=true" \
 -e "hapi.fhir.enable_task_pre_expand_value_sets=true" \
 -e "hapi.fhir.maximum_expansion_size=20000" \
 -e "hapi.fhir.pre_expand_value_sets_max_count=20000" \
 -e "hapi.fhir.pre_expand_value_sets_default_count=20000" \
 hapiproject/hapi:v8.10.0-3
```

Once the container is running:
- Open your browser and navigate to `http://localhost:4200/`.
- Install the FHIR NPM package on the FHIR server so `$evaluate` can find Libraries and ValueSets.
- Optionally POST the Synthea patient Bundles under `public/package/examples/` if you want sample patients.

See [FHIR package](#fhir-package) for how to build that tarball.

## Running from Source Code

### Prerequisites

- Current stable version of Node.js and `npm`, such as installed via the `nvm` Node Version Manager
- "CQL with FHIR"-compliant execution server in FHIR R4 mode. We test against the vanilla the HAPI FHIR JPA server configured as above.

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
- `LIPID_MANAGEMENT_SMART_CLIENT_ID` / `LIPID_MANAGEMENT_SMART_REDIRECT_URI` — SMART-on-FHIR launch

Users can override these in the in-app **Settings** page (browser local storage).

## FHIR package

The FHIR NPM package is the tree at `public/package/`. Author CQL in `cql/*.cql`. `npm run generate:fhir-libraries` compiles those sources to ELM with `@cqframework/cql` and writes `Library-*.json` from the ELM library identifier (name and version). Generation fails if the translator reports any errors.

```bash
npm run generate:sdi-2019         # Regenerates cql/SDI-2019.cql from the Graham Center CSV, then Library JSON
npm run generate:fhir-libraries   # CQL → ELM → Library-*.json and .index.json
npm run package:fhir              # generate:fhir-libraries, then write the .tgz at the repo root
```

`package:fhir` writes `com.prestonlee.fhir.lipid-management-<version>.tgz`. `<version>` comes from `public/package/package.json` (keep that in sync with `library LipidManagement version` in `cql/LipidManagement.cql`). Import the `.tgz` with CQL Studio's FHIR package importer, or any FHIR NPM installer.


### ValueSets

Canonical ValueSets live under `public/package/ValueSet-*.json` and are included in the FHIR NPM package.

| Origin | Meaning |
|---|---|
| **VSAC** | Committed expansions of NLM CTS ValueSets with original VSAC metadata (publisher, purpose, CTS URL). Refresh with a one-off CTS `$expand` + metadata fetch when upstream changes. |
| **ASU** | Custom composes maintained in this repo (`publisher: ASU CDS`) for LOINC/RxNorm observations, therapy flags, and hybrid PREVENT-based criteria. |

CQL references VSAC packs by their CTS `ValueSet.url` and ASU packs by `https://asu.edu/fhir/ValueSet/...`.

## License and Attribution

Source code and algorithm implementations provided under the terms of the Apache 2.0 open source license. Copyright © 2026 Preston Lee. All rights reserved.

**OpenCVDRisk** cardiovascular disease risk scoring utilities are intended to align with those of the American Heart Association's (AHA) PREVENT™ cardiovascular risk algorithms, but do not use AHA source code nor any AHA assets requiring license from AHA. This is not an official AHA product and is neither affiliated with nor endorsed by the AHA, and is based purely on publicly published materials. "PREVENT" is a registered trademark of the American Heart Association.

Statistical model: Khan SS et al., Circulation. 2024;149:430-449. DOI: [10.1161/CIRCULATIONAHA.123.067626](https://doi.org/10.1161/CIRCULATIONAHA.123.067626).

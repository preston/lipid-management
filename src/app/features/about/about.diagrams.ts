// Author: Preston Lee

export interface AboutDiagram {
  id: string;
  hostId: string;
  definition: string;
}

/** Full risk-calculator interaction: preload, prefill, overrides, recalculate, results. */
export const ABOUT_DIAGRAM_OVERVIEW: AboutDiagram = {
  id: 'about-mermaid-overview',
  hostId: 'about-arch-overview-diagram',
  definition: `
sequenceDiagram
  participant Clinician
  participant UI as Browser app
  participant FHIR as FHIR server

  Clinician->>UI: Open calculator with selected patient

  Note over UI,FHIR: 1. Data preloading via CQL
  UI->>FHIR: POST Library/OpenCVDRisk/$evaluate
  Note right of UI: Chart labs, meds, exclusions
  UI->>FHIR: POST Library/BMI/$evaluate
  Note right of UI: Height, weight, BMI
  FHIR-->>UI: Named expression results

  Note over UI: 2. Form prepopulation
  UI-->>Clinician: Prefill form and show provenance

  Note over Clinician,UI: 3. Clinical overrides
  Clinician->>UI: Edit inputs or dismiss exclusions
  Note right of UI: Local UI only - chart data unchanged

  Note over Clinician,FHIR: 4. Manual recalculation
  Clinician->>UI: Calculate risk
  UI->>FHIR: POST Library/OpenCVDRisk/$evaluate
  Note right of UI: 10y and 30y risk expressions

  Note over FHIR: 5. Server runs CQL on Patient chart
  FHIR-->>UI: Risk expression results

  Note over UI,Clinician: 6. Results return to UI
  UI-->>Clinician: Display scores in calculator
`.trim(),
};

export const ABOUT_DIAGRAM_STANDALONE: AboutDiagram = {
  id: 'about-mermaid-standalone',
  hostId: 'about-arch-standalone-diagram',
  definition: `
sequenceDiagram
  participant Clinician
  participant UI as Browser app
  participant FHIR as FHIR server

  Note over UI,FHIR: Optional Loader setup
  UI->>FHIR: PUT ValueSet bundles
  UI->>FHIR: PUT Library resources from app CQL
  FHIR-->>UI: Resources stored

  Clinician->>UI: Search patients
  UI->>FHIR: GET Patient search
  FHIR-->>UI: Matching Patient resources
  Clinician->>UI: Select patient

  Note over UI,FHIR: Prefill from chart
  UI->>FHIR: POST Library/OpenCVDRisk/$evaluate
  UI->>FHIR: POST Library/BMI/$evaluate
  FHIR-->>UI: Chart expression results
  UI-->>Clinician: Prepopulated calculator form

  Clinician->>UI: Override fields if needed
  Clinician->>UI: Calculate risk
  UI->>FHIR: POST Library/OpenCVDRisk/$evaluate
  Note over FHIR: Evaluate risk expressions for subject Patient
  FHIR-->>UI: Parameters with risk values
  UI-->>Clinician: Show 10-year and 30-year risks
`.trim(),
};

export const ABOUT_DIAGRAM_SMART: AboutDiagram = {
  id: 'about-mermaid-smart',
  hostId: 'about-arch-smart-diagram',
  definition: `
sequenceDiagram
  participant EHR as EHR system
  participant UI as Browser app
  participant FHIR as EHR FHIR server

  EHR->>UI: Launch /launch with iss and launch
  UI->>FHIR: SMART OAuth authorize
  FHIR-->>UI: Access token and patient context
  UI->>FHIR: GET Patient
  FHIR-->>UI: Launched Patient resource

  Note over UI,FHIR: Same risk path as standalone after launch
  UI->>FHIR: POST Library/OpenCVDRisk/$evaluate
  UI->>FHIR: POST Library/BMI/$evaluate
  FHIR-->>UI: Chart expression results
  UI-->>EHR: Prepopulated calculator form

  Note over EHR,UI: Clinician may override local form inputs
  EHR->>UI: Calculate risk
  UI->>FHIR: POST Library/OpenCVDRisk/$evaluate
  Note over FHIR: Evaluate risk expressions for launched Patient
  FHIR-->>UI: Parameters with risk values
  UI-->>EHR: Display scores in calculator UI
`.trim(),
};

export const ABOUT_DIAGRAM_CQL_PACKAGING: AboutDiagram = {
  id: 'about-mermaid-cql-packaging',
  hostId: 'about-arch-cql-packaging-diagram',
  definition: `
sequenceDiagram
  participant App as App bundle
  participant Loader as Loader page
  participant FHIR as FHIR server
  participant Calc as Calculator

  App->>Loader: Ship public/cql/*.cql
  App->>Loader: Ship public/value-sets/*.json
  Loader->>FHIR: PUT Library with text/cql content
  Loader->>FHIR: PUT ValueSet transaction Bundles
  FHIR-->>Loader: Libraries and ValueSets stored

  Note over Calc,FHIR: Runtime evaluate uses uploaded Resources
  Calc->>FHIR: POST Library/{id}/$evaluate subject Patient
  FHIR-->>Calc: Expression results for UI
`.trim(),
};

export const ABOUT_DIAGRAMS: readonly AboutDiagram[] = [
  ABOUT_DIAGRAM_OVERVIEW,
  ABOUT_DIAGRAM_STANDALONE,
  ABOUT_DIAGRAM_SMART,
  ABOUT_DIAGRAM_CQL_PACKAGING,
];

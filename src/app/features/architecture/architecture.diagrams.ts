// Author: Preston Lee

export interface ArchitectureDiagram {
  id: string;
  hostId: string;
  definition: string;
}

/** Risk calculator: preload, prefill, form overrides as Parameters, re-evaluate, results. */
export const ARCHITECTURE_DIAGRAM_OVERVIEW: ArchitectureDiagram = {
  id: 'architecture-mermaid-overview',
  hostId: 'architecture-overview-diagram',
  definition: `
sequenceDiagram
  participant Clinician
  participant UI as Browser app
  participant FHIR as FHIR server

  Clinician->>UI: Open calculator with selected patient

  Note over UI,FHIR: 1. Prefill via CQL
  UI->>FHIR: POST Library/OpenCVDRisk/$evaluate
  Note right of UI: Chart labs, meds, exclusions
  UI->>FHIR: POST Library/BMI/$evaluate
  Note right of UI: Height, weight, BMI
  FHIR-->>UI: Named expression results

  Note over UI: 2. Form prepopulation
  UI-->>Clinician: Prefill form and show provenance

  Note over Clinician,UI: 3. Clinical review
  Clinician->>UI: Edit form or adjust exclusions
  Note right of UI: Form values become Calculate inputs

  Note over Clinician,FHIR: 4. Calculate with library Parameters
  Clinician->>UI: Calculate risk
  UI->>FHIR: POST Library/OpenCVDRisk/$evaluate
  Note right of UI: Form overrides as nested parameters

  Note over FHIR: 5. Server runs CQL with Effective coalesced inputs
  FHIR-->>UI: Risk expression results

  Note over UI,Clinician: 6. Results return to UI
  UI-->>Clinician: Display scores in calculator
  Note over UI: Accepted session kept in memory
  UI-->>Clinician: Continue to Guideline when ready
`.trim(),
};

export const ARCHITECTURE_DIAGRAM_STANDALONE: ArchitectureDiagram = {
  id: 'architecture-mermaid-standalone',
  hostId: 'architecture-standalone-diagram',
  definition: `
sequenceDiagram
  participant Clinician
  participant UI as Browser app
  participant FHIR as FHIR server

  alt Search server patient
    Clinician->>UI: Search patients
    UI->>FHIR: GET Patient search
    FHIR-->>UI: Matching Patient resources
    Clinician->>UI: Select patient
  else Custom FHIR Bundle file
    Clinician->>UI: Open Bundle JSON
    Note right of UI: Client Bundle for data parameter
  end

  Note over UI,FHIR: Prefill via CQL
  UI->>FHIR: POST Library/OpenCVDRisk/$evaluate
  UI->>FHIR: POST Library/BMI/$evaluate
  Note right of UI: Custom file uses data and useServerData false
  FHIR-->>UI: Expression results
  UI-->>Clinician: Prepopulated calculator form

  Clinician->>UI: Review or override form values
  Clinician->>UI: Calculate risk
  UI->>FHIR: POST Library/OpenCVDRisk/$evaluate
  Note right of UI: Form values as nested library parameters
  Note over FHIR: Risk expressions with Effective coalesced inputs
  FHIR-->>UI: Parameters with risk values
  UI-->>Clinician: Show 10-year and 30-year risks
`.trim(),
};

export const ARCHITECTURE_DIAGRAM_SMART: ArchitectureDiagram = {
  id: 'architecture-mermaid-smart',
  hostId: 'architecture-smart-diagram',
  definition: `
sequenceDiagram
  participant EHR as EHR system
  participant Clinician
  participant UI as Browser app
  participant FHIR as EHR FHIR server

  EHR->>UI: Open /launch with iss and launch
  UI->>FHIR: SMART OAuth authorize
  FHIR-->>UI: Access token and patient context
  UI->>FHIR: GET Patient
  FHIR-->>UI: Launched Patient resource

  Note over UI,FHIR: Prefill via CQL on EHR chart
  UI->>FHIR: POST Library/OpenCVDRisk/$evaluate
  UI->>FHIR: POST Library/BMI/$evaluate
  FHIR-->>UI: Chart expression results
  UI-->>Clinician: Prepopulated calculator form

  Note over Clinician,UI: Review form - Calculate sends parameters
  Clinician->>UI: Calculate risk
  UI->>FHIR: POST Library/OpenCVDRisk/$evaluate
  Note right of UI: Form values as nested library parameters
  Note over FHIR: Risk expressions for launched Patient
  FHIR-->>UI: Parameters with risk values
  UI-->>Clinician: Display scores in calculator
`.trim(),
};

export const ARCHITECTURE_DIAGRAM_CQL_PACKAGING: ArchitectureDiagram = {
  id: 'architecture-mermaid-cql-packaging',
  hostId: 'architecture-cql-packaging-diagram',
  definition: `
sequenceDiagram
  participant Disk as public package
  participant Tar as FHIR NPM tarball
  participant FHIR as FHIR server
  participant Calc as Calculator

  Disk->>Tar: npm run package:fhir
  Tar->>FHIR: Install CQL Libraries and ValueSets
  FHIR-->>Tar: Resources stored

  Note over Calc,FHIR: Runtime evaluate uses installed resources
  Calc->>FHIR: POST Library id $evaluate with subject Patient
  FHIR-->>Calc: Expression results for UI
`.trim(),
};

export const ARCHITECTURE_DIAGRAMS: readonly ArchitectureDiagram[] = [
  ARCHITECTURE_DIAGRAM_OVERVIEW,
  ARCHITECTURE_DIAGRAM_STANDALONE,
  ARCHITECTURE_DIAGRAM_SMART,
  ARCHITECTURE_DIAGRAM_CQL_PACKAGING,
];

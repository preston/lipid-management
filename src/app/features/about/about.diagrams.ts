// Author: Preston Lee

export interface AboutDiagram {
  id: string;
  hostId: string;
  definition: string;
}

export const ABOUT_DIAGRAM_OVERVIEW: AboutDiagram = {
  id: 'about-mermaid-overview',
  hostId: 'about-arch-overview-diagram',
  definition: `
flowchart LR
  Clinician[Clinician]
  BrowserApp[Browser app]
  FhirServer[FHIR server]
  Clinician --> BrowserApp
  BrowserApp -->|"reads patient data"| FhirServer
  BrowserApp -->|"loads logic and terminology"| FhirServer
  BrowserApp -->|"runs CQL evaluate"| FhirServer
`.trim(),
};

export const ABOUT_DIAGRAM_STANDALONE: AboutDiagram = {
  id: 'about-mermaid-standalone',
  hostId: 'about-arch-standalone-diagram',
  definition: `
sequenceDiagram
  participant Clinician
  participant BrowserApp as Browser app
  participant FhirServer as FHIR server

  Note over BrowserApp,FhirServer: Optional setup via Loader
  BrowserApp->>FhirServer: Upload ValueSet bundles
  BrowserApp->>FhirServer: Upload CQL as Library resources

  Clinician->>BrowserApp: Search and select patient
  BrowserApp->>FhirServer: GET Patient
  FhirServer-->>BrowserApp: Patient resource

  Clinician->>BrowserApp: Open calculator
  BrowserApp->>FhirServer: POST Library/$evaluate (subject Patient)
  FhirServer-->>BrowserApp: Expression results
  BrowserApp-->>Clinician: Show guidance in calculator
`.trim(),
};

export const ABOUT_DIAGRAM_SMART: AboutDiagram = {
  id: 'about-mermaid-smart',
  hostId: 'about-arch-smart-diagram',
  definition: `
sequenceDiagram
  participant EHR as EHR system
  participant BrowserApp as Browser app
  participant FhirServer as EHR FHIR server

  EHR->>BrowserApp: Open /launch with iss and launch
  BrowserApp->>FhirServer: OAuth authorize (SMART)
  FhirServer-->>BrowserApp: Authorization complete
  BrowserApp->>FhirServer: Read launched Patient
  FhirServer-->>BrowserApp: Patient resource

  Note over BrowserApp,FhirServer: Same evaluate path as standalone
  BrowserApp->>FhirServer: POST Library/$evaluate (subject Patient)
  FhirServer-->>BrowserApp: Expression results
  BrowserApp-->>EHR: Show guidance in calculator
`.trim(),
};

export const ABOUT_DIAGRAM_CQL_PACKAGING: AboutDiagram = {
  id: 'about-mermaid-cql-packaging',
  hostId: 'about-arch-cql-packaging-diagram',
  definition: `
flowchart TB
  CqlSource["CQL source files in app"]
  VsJson["ValueSet JSON bundles in app"]
  Loader[Loader page]
  LibRes["FHIR Library resources"]
  VsRes["FHIR ValueSet resources"]
  FhirServer[FHIR server]
  Evaluate["Library evaluate operation"]

  CqlSource -->|"packaged as text/cql content"| LibRes
  VsJson -->|"transaction Bundle PUT"| VsRes
  Loader --> LibRes
  Loader --> VsRes
  LibRes --> FhirServer
  VsRes --> FhirServer
  FhirServer --> Evaluate
`.trim(),
};

export const ABOUT_DIAGRAMS: readonly AboutDiagram[] = [
  ABOUT_DIAGRAM_OVERVIEW,
  ABOUT_DIAGRAM_STANDALONE,
  ABOUT_DIAGRAM_SMART,
  ABOUT_DIAGRAM_CQL_PACKAGING,
];

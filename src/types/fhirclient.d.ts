// Author: Preston Lee

declare module 'fhirclient' {
  const FHIR: {
    oauth2: {
      authorize: (options: Record<string, unknown>) => Promise<unknown>;
      ready: () => Promise<{
        patient: { id?: string; read: () => Promise<unknown> };
        state: { serverUrl?: string };
      }>;
    };
  };
  export default FHIR;
}

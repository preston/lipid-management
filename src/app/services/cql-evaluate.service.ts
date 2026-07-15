// Author: Preston Lee

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Parameters, ParametersParameter } from 'fhir/r4';
import { PatientContextService } from './patient-context.service';

export interface CqlExpressionResult {
  name: string;
  value: unknown;
}

/** Named library parameters for CQL $evaluate (nested FHIR Parameters). */
export type CqlLibraryParameterValue =
  | boolean
  | string
  | number
  | { integer: number }
  | { decimal: number };

@Injectable({
  providedIn: 'root',
})
export class CqlEvaluateService {
  private readonly http = inject(HttpClient);
  private readonly patientContext = inject(PatientContextService);

  evaluateLibrary(
    libraryId: string,
    expressionNames?: string[],
    libraryParameters?: Record<string, CqlLibraryParameterValue>,
  ): Observable<Record<string, unknown>> {
    const patient = this.patientContext.selectedPatient();
    if (!patient?.id) {
      throw new Error('A patient must be selected before CQL evaluation.');
    }

    const base = this.patientContext.activeFhirBaseUrl();
    const clientData = this.patientContext.clientDataBundle();
    const body: Parameters = {
      resourceType: 'Parameters',
      parameter: [
        {
          name: 'subject',
          valueString: `Patient/${patient.id}`,
        },
        ...this.libraryParameterParts(libraryParameters),
        ...(clientData
          ? ([
              { name: 'useServerData', valueBoolean: false },
              { name: 'data', resource: clientData },
            ] satisfies ParametersParameter[])
          : []),
        ...(expressionNames ?? []).map(
          (name): ParametersParameter => ({
            name: 'expression',
            valueString: name,
          }),
        ),
      ],
    };

    return this.http
      .post<Parameters>(`${base}/Library/${encodeURIComponent(libraryId)}/$evaluate`, body)
      .pipe(map((params) => this.parametersToMap(params)));
  }

  private libraryParameterParts(
    libraryParameters?: Record<string, CqlLibraryParameterValue>,
  ): ParametersParameter[] {
    if (!libraryParameters || Object.keys(libraryParameters).length === 0) {
      return [];
    }
    const nested: ParametersParameter[] = [];
    for (const [name, value] of Object.entries(libraryParameters)) {
      nested.push(this.toLibraryParameterPart(name, value));
    }
    return [
      {
        name: 'parameters',
        resource: {
          resourceType: 'Parameters',
          parameter: nested,
        } as Parameters,
      },
    ];
  }

  private toLibraryParameterPart(name: string, value: CqlLibraryParameterValue): ParametersParameter {
    const part: ParametersParameter = { name };
    if (typeof value === 'boolean') {
      part.valueBoolean = value;
      return part;
    }
    if (typeof value === 'string') {
      part.valueString = value;
      return part;
    }
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        part.valueInteger = value;
      } else {
        part.valueDecimal = value;
      }
      return part;
    }
    if ('integer' in value) {
      part.valueInteger = value.integer;
      return part;
    }
    part.valueDecimal = value.decimal;
    return part;
  }

  private parametersToMap(parameters: Parameters): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const p of parameters.parameter ?? []) {
      if (!p.name) {
        continue;
      }
      out[p.name] = this.readParameterValue(p);
    }
    return out;
  }

  private readParameterValue(p: ParametersParameter): unknown {
    if (p.resource) {
      return p.resource;
    }
    if (p.valueBoolean != null) {
      return p.valueBoolean;
    }
    if (p.valueInteger != null) {
      return p.valueInteger;
    }
    if (p.valueDecimal != null) {
      return p.valueDecimal;
    }
    if (p.valueString != null) {
      return p.valueString;
    }
    if (p.valueDate != null) {
      return p.valueDate;
    }
    if (p.valueDateTime != null) {
      return p.valueDateTime;
    }
    if (p.valueQuantity) {
      return p.valueQuantity;
    }
    if (p.valueCodeableConcept) {
      return p.valueCodeableConcept;
    }
    if (p.valueReference) {
      return p.valueReference;
    }
    if (p.part?.length) {
      const nested: Record<string, unknown> = {};
      for (const part of p.part) {
        if (part.name) {
          nested[part.name] = this.readParameterValue(part);
        }
      }
      return nested;
    }
    return null;
  }
}

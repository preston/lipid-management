// Author: Preston Lee

import { describe, expect, it } from 'vitest';
import { extractElmLibraryIdentifier, translateCqlToElm } from '../../scripts/cql-to-elm/translate';

const helloCql = `library HelloIdentity version '1.2.3'
using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1'
context Patient
define One: 1
`;

describe('CQL-to-ELM library identity', () => {
  it('reads library id and version from ELM JSON', () => {
    expect(
      extractElmLibraryIdentifier(
        JSON.stringify({ library: { identifier: { id: 'Hello', version: '9.9.9' } } }),
      ),
    ).toEqual({ id: 'Hello', version: '9.9.9' });
  });

  it('compiles CQL and takes identity from the ELM AST', () => {
    const result = translateCqlToElm(helloCql);
    expect(result.errors, result.errors.join('\n')).toEqual([]);
    expect(result.identifier).toEqual({ id: 'HelloIdentity', version: '1.2.3' });
  });
});

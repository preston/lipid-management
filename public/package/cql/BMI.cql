/*
  BMI lookup and calculation for FHIR R4 Patient context.

  Methodology:
  1) [Default] Computed BMI from the most recent weight and height Observations (with unit conversion)
  2) [Fallback] The most recent explicit BMI Observation (LOINC 39156-5)

  If BMI cannot be determined, expressions return null.

  Author: Preston Lee
*/

library BMI version '1.0.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1'

codesystem "LOINC": 'http://loinc.org'

valueset "BodyWeight": 'https://asu.edu/fhir/ValueSet/body-weight'
valueset "BodyHeight": 'https://asu.edu/fhir/ValueSet/body-height'
valueset "BodyMassIndex": 'https://asu.edu/fhir/ValueSet/body-mass-index'

code "BMI LOINC": '39156-5' from "LOINC" display 'Body mass index (BMI) [Ratio]'
code "Body Height": '8302-2' from "LOINC" display 'Body height'
code "Body Weight": '29463-7' from "LOINC" display 'Body weight'

context Patient

define function RecordedBodyWeight():
  First([Observation: "BodyWeight"] W
      where W.status in { 'final', 'amended', 'corrected' }
        and W.effective is not null
        and W.value is FHIR.Quantity
      sort by start of effective desc
  )

define function RecordedBodyHeight():
  First([Observation: "BodyHeight"] H
      where H.status in { 'final', 'amended', 'corrected' }
        and H.effective is not null
        and H.value is FHIR.Quantity
      sort by start of effective desc
  )

define function RecordedBMI():
  First([Observation: "BodyMassIndex"] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.effective is not null
        and O.value is FHIR.Quantity
      sort by start of effective desc
  )

define function ComputeBMIFromWeightAndHeight():
  case
    when RecordedBodyWeight() is null
      or RecordedBodyHeight() is null then null
    else ( convert ( ( convert FHIRHelpers.ToQuantity ( RecordedBodyWeight().value as FHIR.Quantity ) to 'kg' ) / ( ( convert FHIRHelpers.ToQuantity ( RecordedBodyHeight().value as FHIR.Quantity ) to 'm' ) * ( convert FHIRHelpers.ToQuantity ( RecordedBodyHeight().value as FHIR.Quantity ) to 'm' ) ) ) to 'kg/m2' )
  end

define function BestBMI():
  Coalesce(ComputeBMIFromWeightAndHeight(),
    case
      when RecordedBMI() is not null then FHIRHelpers.ToQuantity(RecordedBMI().value as FHIR.Quantity)
      else null
    end
  )

define MostRecentRecordedBodyHeight:
  RecordedBodyHeight()

define MostRecentRecordedBodyWeight:
  RecordedBodyWeight()

define MostRecentRecordedBMI:
  RecordedBMI()

define ComputedBMI:
  ComputeBMIFromWeightAndHeight()

define UsedBMI:
  BestBMI()

define BestBmiKgM2:
  case
    when BestBMI() is null then null
    else BestBMI().value
  end

define HeightCm:
  case
    when RecordedBodyHeight() is null then null
    else ( convert FHIRHelpers.ToQuantity ( RecordedBodyHeight().value as FHIR.Quantity ) to 'cm' ).value
  end

define WeightKg:
  case
    when RecordedBodyWeight() is null then null
    else ( convert FHIRHelpers.ToQuantity ( RecordedBodyWeight().value as FHIR.Quantity ) to 'kg' ).value
  end

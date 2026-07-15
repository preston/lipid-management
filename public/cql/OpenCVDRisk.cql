/*
  OpenCVDRisk: open-source implementation of the AHA PREVENT™ simplified regression
  (10- and 30-year) cardiovascular risk estimates.

  Not an official American Heart Association (AHA) product and not affiliated with
  or endorsed by the AHA.

  Statistical model: Khan SS et al., Circulation. 2024;149:430-449.
  DOI: 10.1161/CIRCULATIONAHA.123.067626

  Numeric coefficients and variable centering/splines match the open-source
  preventr package (GPL-3): https://github.com/martingmayer/preventr
  - coefficients were extracted from preventr sysdata.rda (base_10yr / base_30yr)
    for interoperability; confirm organizational policy before redistribution.

  preventr implements the published simplified logistic approximation:
  risk = exp(linear_predictor) / (1 + exp(linear_predictor)).

  This library is decision support only, not a substitute for clinical judgment.
*/
library OpenCVDRisk version '0.0.2'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'

codesystem "LOINC": 'http://loinc.org'
codesystem "SNOMED": 'http://snomed.info/sct'
codesystem "RxNorm": 'http://www.nlm.nih.gov/research/umls/rxnorm'

valueset "DiabetesMellitusType2": 'https://asu.edu/fhir/ValueSet/diabetes-mellitus-type-2'

code "Total cholesterol": '2093-3' from "LOINC"
code "HDL cholesterol": '2085-9' from "LOINC"
code "LDL calculated": '2089-1' from "LOINC"
code "Systolic BP": '8480-6' from "LOINC"
code "Creatinine": '2160-0' from "LOINC"
code "Body weight": '29463-7' from "LOINC"
code "Body height": '8302-2' from "LOINC"
code "BMI LOINC": '39156-5' from "LOINC"
code "Tobacco smoking status": '72166-2' from "LOINC"

context Patient

/* --- Coefficient vectors (order matches preventr prep_terms for base model) --- */


define Beta10FemaleTotalCvd:
  List < System.Decimal > { 0.7939329, 0.0305239, - 0.1606857, - 0.2394003, 0.3600781, 0.8667604, 0.5360739, 0.0, 0.0, 0.6045917, 0.0433769, 0.3151672, - 0.1477655, - 0.0663612, 0.1197879, - 0.0819715, 0.0306769, - 0.0946348, - 0.27057, - 0.078715, 0.0, - 0.1637806, - 3.307728 }

define Beta10MaleTotalCvd:
  List < System.Decimal > { 0.7688528, 0.0736174, - 0.0954431, - 0.4347345, 0.3362658, 0.7692857, 0.4386871, 0.0, 0.0, 0.5378979, 0.0164827, 0.288879, - 0.1337349, - 0.0475924, 0.150273, - 0.0517874, 0.0191169, - 0.1049477, - 0.2251948, - 0.0895067, 0.0, - 0.1543702, - 3.031168 }

define Beta10FemaleAscvd:
  List < System.Decimal > { 0.719883, 0.1176967, - 0.151185, - 0.0835358, 0.3592852, 0.8348585, 0.4831078, 0.0, 0.0, 0.4864619, 0.0397779, 0.2265309, - 0.0592374, - 0.0395762, 0.0844423, - 0.0567839, 0.0325692, - 0.1035985, - 0.2417542, - 0.0791142, 0.0, - 0.1671492, - 3.819975 }

define Beta10MaleAscvd:
  List < System.Decimal > { 0.7099847, 0.1658663, - 0.1144285, - 0.2837212, 0.3239977, 0.7189597, 0.3956973, 0.0, 0.0, 0.3690075, 0.0203619, 0.2036522, - 0.0865581, - 0.0322916, 0.114563, - 0.0300005, 0.0232747, - 0.0927024, - 0.2018525, - 0.0970527, 0.0, - 0.1217081, - 3.500655 }

define Beta10FemaleHf:
  List < System.Decimal > { 0.8998235, 0.0, 0.0, - 0.4559771, 0.3576505, 1.038346, 0.583916, - 0.0072294, 0.2997706, 0.7451638, 0.0557087, 0.3534442, 0.0, - 0.0981511, 0.0, 0.0, 0.0, - 0.0946663, - 0.3581041, - 0.1159453, - 0.003878, - 0.1884289, - 4.310409 }

define Beta10MaleHf:
  List < System.Decimal > { 0.8972642, 0.0, 0.0, - 0.6811466, 0.3634461, 0.923776, 0.5023736, - 0.0485841, 0.3726929, 0.6926917, 0.0251827, 0.2980922, 0.0, - 0.0497731, 0.0, 0.0, 0.0, - 0.1289201, - 0.3040924, - 0.1401688, 0.0068126, - 0.1797778, - 3.946391 }

define Beta30FemaleTotalCvd:
  List < System.Decimal > { 0.5503079, - 0.0928369, 0.0409794, - 0.1663306, - 0.1628654, 0.3299505, 0.6793894, 0.3196112, 0.0, 0.0, 0.1857101, 0.0553528, 0.2894, - 0.075688, - 0.056367, 0.1071019, - 0.0751438, 0.0301786, - 0.0998776, - 0.3206166, - 0.1607862, 0.0, - 0.1450788, - 1.318827 }

define Beta30MaleTotalCvd:
  List < System.Decimal > { 0.4627309, - 0.0984281, 0.0836088, - 0.1029824, - 0.2140352, 0.2904325, 0.5331276, 0.2141914, 0.0, 0.0, 0.1155556, 0.0603775, 0.232714, - 0.0272112, - 0.0384488, 0.134192, - 0.0511759, 0.0165865, - 0.1101437, - 0.2585943, - 0.1566406, 0.0, - 0.1166776, - 1.148204 }

/* --- Core math (preventr prep_terms base model, mg/dL cholesterol) --- */


define function Sigmoid(logOdds System.Decimal):
  Exp(logOdds) / ( 1.0 + Exp(logOdds) )

/* CQL list indexing is 0-based (HL7 CQL Indexer); indices align with preventr prep term order. */


define function DotProduct23(betas List<System.Decimal>, terms List<System.Decimal>):
  ( betas[0]* terms[0]) + ( betas[1]* terms[1]) + ( betas[2]* terms[2]) + ( betas[3]* terms[3]) + ( betas[4]* terms[4]) + ( betas[5]* terms[5]) + ( betas[6]* terms[6]) + ( betas[7]* terms[7]) + ( betas[8]* terms[8]) + ( betas[9]* terms[9]) + ( betas[10]* terms[10]) + ( betas[11]* terms[11]) + ( betas[12]* terms[12]) + ( betas[13]* terms[13]) + ( betas[14]* terms[14]) + ( betas[15]* terms[15]) + ( betas[16]* terms[16]) + ( betas[17]* terms[17]) + ( betas[18]* terms[18]) + ( betas[19]* terms[19]) + ( betas[20]* terms[20]) + ( betas[21]* terms[21]) + ( betas[22]* terms[22])

define function DotProduct24(betas List<System.Decimal>, terms List<System.Decimal>):
  ( betas[0]* terms[0]) + ( betas[1]* terms[1]) + ( betas[2]* terms[2]) + ( betas[3]* terms[3]) + ( betas[4]* terms[4]) + ( betas[5]* terms[5]) + ( betas[6]* terms[6]) + ( betas[7]* terms[7]) + ( betas[8]* terms[8]) + ( betas[9]* terms[9]) + ( betas[10]* terms[10]) + ( betas[11]* terms[11]) + ( betas[12]* terms[12]) + ( betas[13]* terms[13]) + ( betas[14]* terms[14]) + ( betas[15]* terms[15]) + ( betas[16]* terms[16]) + ( betas[17]* terms[17]) + ( betas[18]* terms[18]) + ( betas[19]* terms[19]) + ( betas[20]* terms[20]) + ( betas[21]* terms[21]) + ( betas[22]* terms[22]) + ( betas[23]* terms[23])

/* Function bodies may not use standalone let/return (CQL grammar: functionBody is a single expression). */


define function PrepAgeTen(ageYears System.Integer):
  ( ageYears - 55 ) / 10.0

define function PrepNonHdlMmol(totalCholMgDl System.Decimal, hdlMgDl System.Decimal):
  ( ( totalCholMgDl - hdlMgDl ) / 38.67 ) - 3.5

define function PrepHdlScaled(hdlMgDl System.Decimal):
  ( ( hdlMgDl / 38.67 ) - 1.3 ) / 0.3

define function SplineSbpLt(sbpMmHg System.Decimal):
  ( ( if sbpMmHg < 110.0 then sbpMmHg 
        else 110.0
    ) - 110.0
  ) / 20.0

define function SplineSbpGte(sbpMmHg System.Decimal):
  ( ( if sbpMmHg > 110.0 then sbpMmHg 
        else 110.0
    ) - 130.0
  ) / 20.0

define function SplineBmiLt(bmiKgM2 System.Decimal):
  ( ( if bmiKgM2 < 30.0 then bmiKgM2 
        else 30.0
    ) - 25.0
  ) / 5.0

define function SplineBmiGte(bmiKgM2 System.Decimal):
  ( ( if bmiKgM2 > 30.0 then bmiKgM2 
        else 30.0
    ) - 30.0
  ) / 5.0

define function SplineEgfrLt(egfr System.Decimal):
  ( ( if egfr < 60.0 then egfr 
        else 60.0
    ) - 60.0
  ) / - 15.0

define function SplineEgfrGte(egfr System.Decimal):
  ( ( if egfr > 60.0 then egfr 
        else 60.0
    ) - 90.0
  ) / - 15.0

define function BoolAsDecimal(b System.Boolean):
  if b then 1.0 
    else 0.0

define function PrepTerms10YrBase(ageYears System.Integer, totalCholMgDl System.Decimal, hdlMgDl System.Decimal, sbpMmHg System.Decimal, dm System.Boolean, smoking System.Boolean, bmiKgM2 System.Decimal, egfr System.Decimal, bpTx System.Boolean, statin System.Boolean):
  List < System.Decimal > { PrepAgeTen(ageYears), PrepNonHdlMmol(totalCholMgDl, hdlMgDl), PrepHdlScaled(hdlMgDl), SplineSbpLt(sbpMmHg), SplineSbpGte(sbpMmHg), BoolAsDecimal(dm), BoolAsDecimal(smoking), SplineBmiLt(bmiKgM2), SplineBmiGte(bmiKgM2), SplineEgfrLt(egfr), SplineEgfrGte(egfr), BoolAsDecimal(bpTx), BoolAsDecimal(statin), BoolAsDecimal(bpTx) * SplineSbpGte(sbpMmHg), BoolAsDecimal(statin) * PrepNonHdlMmol(totalCholMgDl, hdlMgDl), PrepAgeTen(ageYears) * PrepNonHdlMmol(totalCholMgDl, hdlMgDl), PrepAgeTen(ageYears) * PrepHdlScaled(hdlMgDl), PrepAgeTen(ageYears) * SplineSbpGte(sbpMmHg), PrepAgeTen(ageYears) * BoolAsDecimal(dm), PrepAgeTen(ageYears) * BoolAsDecimal(smoking), PrepAgeTen(ageYears) * SplineBmiGte(bmiKgM2), PrepAgeTen(ageYears) * SplineEgfrLt(egfr), 1.0 }

define function PrepTerms30YrBase(ageYears System.Integer, totalCholMgDl System.Decimal, hdlMgDl System.Decimal, sbpMmHg System.Decimal, dm System.Boolean, smoking System.Boolean, bmiKgM2 System.Decimal, egfr System.Decimal, bpTx System.Boolean, statin System.Boolean):
  List < System.Decimal > { PrepAgeTen(ageYears), PrepAgeTen(ageYears) * PrepAgeTen(ageYears), PrepNonHdlMmol(totalCholMgDl, hdlMgDl), PrepHdlScaled(hdlMgDl), SplineSbpLt(sbpMmHg), SplineSbpGte(sbpMmHg), BoolAsDecimal(dm), BoolAsDecimal(smoking), SplineBmiLt(bmiKgM2), SplineBmiGte(bmiKgM2), SplineEgfrLt(egfr), SplineEgfrGte(egfr), BoolAsDecimal(bpTx), BoolAsDecimal(statin), BoolAsDecimal(bpTx) * SplineSbpGte(sbpMmHg), BoolAsDecimal(statin) * PrepNonHdlMmol(totalCholMgDl, hdlMgDl), PrepAgeTen(ageYears) * PrepNonHdlMmol(totalCholMgDl, hdlMgDl), PrepAgeTen(ageYears) * PrepHdlScaled(hdlMgDl), PrepAgeTen(ageYears) * SplineSbpGte(sbpMmHg), PrepAgeTen(ageYears) * BoolAsDecimal(dm), PrepAgeTen(ageYears) * BoolAsDecimal(smoking), PrepAgeTen(ageYears) * SplineBmiGte(bmiKgM2), PrepAgeTen(ageYears) * SplineEgfrLt(egfr), 1.0 }

define function Risk10YrFromBetas(betas List<System.Decimal>, terms List<System.Decimal>):
  case
    when terms is null then null 
    else Sigmoid(DotProduct23(betas, terms)) end

define function Risk30YrFromBetas(betas List<System.Decimal>, terms List<System.Decimal>):
  case
    when terms is null then null 
    else Sigmoid(DotProduct24(betas, terms)) end

/* CKD-EPI 2021 creatinine equation (Scr mg/dL), race-free */


define function Egfr2021Base(scrMgDl System.Decimal, ageYears System.Integer, k System.Decimal, alpha System.Decimal):
  142.0 * Power((if scrMgDl / k <= 1.0 then scrMgDl / k 
        else 1.0
    ), alpha
  ) * Power((if scrMgDl / k >= 1.0 then scrMgDl / k 
        else 1.0
    ), - 1.2
  ) * Power(0.9938, ageYears)

define function Egfr2021Creatinine(scrMgDl System.Decimal, ageYears System.Integer, female System.Boolean):
  if female then Egfr2021Base(scrMgDl, ageYears, 0.7, - 0.241) * 1.012 
    else Egfr2021Base(scrMgDl, ageYears, 0.9, - 0.303)

define function ObservationQuantityToMgDl(q FHIR.Quantity):
  ( convert FHIRHelpers.ToQuantity ( q ) to 'mg/dL' ).value

/* Latest labs: sort by start of effective (same idea as WeightManagementMedication; FHIRHelpers ToInterval applies when you need Period bounds explicitly). */


define LatestTotalCholObservation:
  First([Observation: "Total cholesterol"] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.value is FHIR.Quantity
        and O.effective is not null
      sort by start of effective desc
  )

define LatestHdlObservation:
  First([Observation: "HDL cholesterol"] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.value is FHIR.Quantity
        and O.effective is not null
      sort by start of effective desc
  )

define LatestLdlObservation:
  First([Observation: "LDL calculated"] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.value is FHIR.Quantity
        and O.effective is not null
      sort by start of effective desc
  )

define LatestSbpObservation:
  First([Observation: "Systolic BP"] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.value is FHIR.Quantity
        and O.effective is not null
      sort by start of effective desc
  )

define LatestCreatinineObservation:
  First([Observation: "Creatinine"] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.value is FHIR.Quantity
        and O.effective is not null
      sort by start of effective desc
  )

define LatestTotalCholMgDl:
  case
    when LatestTotalCholObservation is not null then ObservationQuantityToMgDl(LatestTotalCholObservation.value as FHIR.Quantity) 
    else null end

define LatestHdlMgDl:
  case
    when LatestHdlObservation is not null then ObservationQuantityToMgDl(LatestHdlObservation.value as FHIR.Quantity) 
    else null end

define LatestLdlMgDl:
  case
    when LatestLdlObservation is not null then ObservationQuantityToMgDl(LatestLdlObservation.value as FHIR.Quantity) 
    else null end

define LatestSbpMmHg:
  case
    when LatestSbpObservation is not null then FHIRHelpers.ToQuantity ( LatestSbpObservation.value as FHIR.Quantity ).value 
    else null end

define LatestCreatinineMgDl:
  case
    when LatestCreatinineObservation is not null then ObservationQuantityToMgDl(LatestCreatinineObservation.value as FHIR.Quantity) 
    else null end

define function RecordedBodyWeight():
  First([Observation: "Body weight"] W
      where W.status in { 'final', 'amended', 'corrected' }
        and W.effective is not null
        and W.value is FHIR.Quantity
      sort by start of effective desc
  )

define function RecordedBodyHeight():
  First([Observation: "Body height"] H
      where H.status in { 'final', 'amended', 'corrected' }
        and H.effective is not null
        and H.value is FHIR.Quantity
      sort by start of effective desc
  )

define function RecordedBmi():
  First([Observation: "BMI LOINC"] B
      where B.status in { 'final', 'amended', 'corrected' }
        and B.effective is not null
        and B.value is FHIR.Quantity
      sort by start of effective desc
  )

define ComputedBmiKgM2:
  case
    when RecordedBodyWeight() is not null
      and RecordedBodyHeight() is not null then ( convert ( ( convert FHIRHelpers.ToQuantity ( RecordedBodyWeight().value as FHIR.Quantity ) to 'kg' ) / ( ( convert FHIRHelpers.ToQuantity ( RecordedBodyHeight().value as FHIR.Quantity ) to 'm' ) * ( convert FHIRHelpers.ToQuantity ( RecordedBodyHeight().value as FHIR.Quantity ) to 'm' ) ) ) to 'kg/m2' ).value 
    else null end

define BestBmiKgM2:
  Coalesce(ComputedBmiKgM2,
    case
      when RecordedBmi() is not null then FHIRHelpers.ToQuantity(RecordedBmi().value as FHIR.Quantity).value 
      else null 
    end
  )

define IsFemale:
  Patient.gender ~ 'female'

define IsMale:
  Patient.gender ~ 'male'

define HasDiabetesMellitusType2:
  exists ( [Condition: "DiabetesMellitusType2"] C
      where exists ( C.clinicalStatus.coding CSCode
          where CSCode.code ~ 'active'
      )
  )

define LatestSmokingObservation:
  First([Observation: "Tobacco smoking status"] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.effective is not null
      sort by start of effective desc
  )

/* Current cigarette use approximations (SNOMED CT in Synthea; extend as needed). */


define CurrentSmokingFromObservation:
  case
    when LatestSmokingObservation is null then false
    when exists ( ( ( LatestSmokingObservation.value as FHIR.CodeableConcept ).coding ) C
        where C.code.value in { '449868002', '65568007', '77176002', '8517006', '160604004', '266920004', '702318004', '81703003' }
    ) then true 
    else false end

/* RxNorm ingredient / common oral products (extend for local formularies). */


define ActiveStatinTherapy:
  exists ( [MedicationRequest] M
      where M.status in { 'active', 'on-hold' }
        and exists ( ( ( M.medication as FHIR.CodeableConcept ).coding ) C
            where C.system.value = "RxNorm".id
              and C.code.value in { '312961', '314231', '617312', '617511', '859747', '833036', '860975', '197903', '198211', '200345', '259255' }
        )
  )

define ActiveAntihypertensiveTherapy:
  exists ( [MedicationRequest] M
      where M.status in { 'active', 'on-hold' }
        and exists ( ( ( M.medication as FHIR.CodeableConcept ).coding ) C
            where C.system.value = "RxNorm".id
              and C.code.value in { '314076', '314077', '199889', '197361', '746030', '746032', '897718', '999969', '1049620', '1364430', '1364445', '310798', '314048', '314049', '1656340' }
        )
  )

define EgfrFromCreatinine:
  case
    when LatestCreatinineMgDl is null then null
    when not ( IsFemale
        or IsMale
    ) then null 
    else Egfr2021Creatinine(LatestCreatinineMgDl, AgeInYears(), IsFemale) end

define InputsComplete:
  AgeInYears() >= 30
    and AgeInYears() <= 79
    and ( IsFemale
        or IsMale
    )
    and LatestTotalCholMgDl is not null
    and LatestHdlMgDl is not null
    and LatestSbpMmHg is not null
    and BestBmiKgM2 is not null
    and EgfrFromCreatinine is not null

/* Only build term vectors when inputs are complete; avoids null arithmetic when OpenCVDRisk cannot run. */


define PrepTerms10:
  case
    when InputsComplete then PrepTerms10YrBase(AgeInYears(), LatestTotalCholMgDl, LatestHdlMgDl, LatestSbpMmHg, HasDiabetesMellitusType2, CurrentSmokingFromObservation, BestBmiKgM2, EgfrFromCreatinine, ActiveAntihypertensiveTherapy, ActiveStatinTherapy) 
    else null end

define PrepTerms30:
  case
    when InputsComplete then PrepTerms30YrBase(AgeInYears(), LatestTotalCholMgDl, LatestHdlMgDl, LatestSbpMmHg, HasDiabetesMellitusType2, CurrentSmokingFromObservation, BestBmiKgM2, EgfrFromCreatinine, ActiveAntihypertensiveTherapy, ActiveStatinTherapy) 
    else null end

define TenYearTotalCvdProbability:
  case
    when not InputsComplete then null
    when IsMale then Risk10YrFromBetas(Beta10MaleTotalCvd, PrepTerms10) 
    else Risk10YrFromBetas(Beta10FemaleTotalCvd, PrepTerms10) end

define TenYearTotalCvdPercent:
  case
    when TenYearTotalCvdProbability is null then null 
    else 100.0 * TenYearTotalCvdProbability end

define ThirtyYearTotalCvdProbability:
  case
    when not InputsComplete then null
    when IsMale then Risk30YrFromBetas(Beta30MaleTotalCvd, PrepTerms30) 
    else Risk30YrFromBetas(Beta30FemaleTotalCvd, PrepTerms30) end

define ThirtyYearTotalCvdPercent:
  case
    when ThirtyYearTotalCvdProbability is null then null 
    else 100.0 * ThirtyYearTotalCvdProbability end

define TenYearAscvdProbability:
  case
    when not InputsComplete then null
    when IsMale then Risk10YrFromBetas(Beta10MaleAscvd, PrepTerms10) 
    else Risk10YrFromBetas(Beta10FemaleAscvd, PrepTerms10) end

define TenYearHeartFailureProbability:
  case
    when not InputsComplete then null
    when IsMale then Risk10YrFromBetas(Beta10MaleHf, PrepTerms10) 
    else Risk10YrFromBetas(Beta10FemaleHf, PrepTerms10) end
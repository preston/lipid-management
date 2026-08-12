/*
  VA/DoD Clinical Practice Guideline on Lipid Management for Cardiovascular Disease Risk Reduction (2025).
  Management algorithm (Appendix G narrative; figure page 20) plus Recommendation 1–24 applicability signals.

  10-year risk: OpenCVDRisk.TenYearTotalCvdPercent (PREVENT total CVD % × 100). Host systems should pass the
  same Override* Parameters used by the calculator so Box 8/12 thresholds match the accepted session.

  Clinician parameters that are unset (null) mean "unknown" and produce NeedsClinicalInput rather than
  silently treating the answer as No.

  CDS outputs are not treatment orders. OpenCVDRisk is an open-source PREVENT implementation and is not
  affiliated with or endorsed by the AHA.

  Author: Preston Lee
*/
library LipidManagement version '0.2.0'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'
include OpenCVDRisk version '0.6.0' called OpenCVDRisk

codesystem "SNOMED": 'http://snomed.info/sct'
codesystem "LOINC": 'http://loinc.org'

valueset "AtheroscleroticCardiovascularDisease": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113762.1.4.1178.149'
valueset "DiabetesMellitus": 'https://asu.edu/fhir/ValueSet/diabetes-mellitus'
valueset "DiabetesMellitusType2": 'https://asu.edu/fhir/ValueSet/diabetes-mellitus-type-2'
valueset "HIVInfection": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.464.1003.120.12.1003'
valueset "EndStageKidneyDisease": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113883.3.526.3.353'
valueset "HeartFailureWithReducedEjectionFraction": 'https://asu.edu/fhir/ValueSet/heart-failure-with-reduced-ejection-fraction'
valueset "InheritedCardiovascularCondition": 'https://asu.edu/fhir/ValueSet/inherited-cardiovascular-condition'
valueset "LeftVentricularEjectionFraction": 'https://asu.edu/fhir/ValueSet/left-ventricular-ejection-fraction'
valueset "Triglycerides": 'https://asu.edu/fhir/ValueSet/triglycerides'
valueset "LipoproteinA": 'https://asu.edu/fhir/ValueSet/lipoprotein-a'
valueset "AspartateAminotransferase": 'https://asu.edu/fhir/ValueSet/aspartate-aminotransferase'
valueset "AlanineAminotransferase": 'https://asu.edu/fhir/ValueSet/alanine-aminotransferase'
valueset "StatinTherapy": 'https://asu.edu/fhir/ValueSet/statin-therapy'
valueset "EzetimibeTherapy": 'https://asu.edu/fhir/ValueSet/ezetimibe-therapy'
valueset "Pcsk9MonoclonalAntibodyTherapy": 'https://asu.edu/fhir/ValueSet/pcsk9-monoclonal-antibody-therapy'
valueset "BempedoicAcidTherapy": 'https://asu.edu/fhir/ValueSet/bempedoic-acid-therapy'
valueset "FibrateTherapy": 'https://asu.edu/fhir/ValueSet/fibrate-therapy'
valueset "IcosapentEthylTherapy": 'https://asu.edu/fhir/ValueSet/icosapent-ethyl-therapy'
valueset "MiAcsCabgPci": 'https://asu.edu/fhir/ValueSet/mi-acs-cabg-pci'
valueset "CoronaryArteryCalciumScore": 'https://asu.edu/fhir/ValueSet/coronary-artery-calcium-score'

/* Clinician judgments: null = unknown (do not default to false). */
parameter LifeExpectancyLimitedUnder5Years Boolean
parameter BorderlineRiskPatientDesiresStatin Boolean
parameter RecentMiAcsOrCabgPciWithin6Weeks Boolean
parameter VeryHighRiskRecentAcsOrMiOnTherapy Boolean
parameter VeryHighRiskRecurrentEventsOnTherapy Boolean
parameter OnLipidLoweringTherapy Boolean
parameter EscalationNeeded Boolean
parameter PersistentlyElevatedFastingTriglycerides Boolean
parameter StatinIntoleranceAttested Boolean
parameter UnableToTakeStatin Boolean
parameter CacWouldChangeManagement Boolean
parameter ClinicalRiskIntermediateOrHigh Boolean
parameter ClinicalRiskLow Boolean
parameter AstAltLessThan3xUlnConfirmed Boolean

/* Session replay fallbacks when included OpenCVDRisk Override* binding is unavailable. */
parameter OverrideTenYearTotalCvdPercent Decimal
parameter OverrideLdlMgDl Decimal
parameter OverrideHasDiabetes Boolean
parameter OverrideAgeYears Integer

context Patient

define EffectiveAgeYears:
  Coalesce(OverrideAgeYears, OpenCVDRisk.EffectiveAgeYears, AgeInYears())

define IsAdult:
  EffectiveAgeYears >= 18

define HasEstablishedCvd:
  /* Sidebar 3 clinical ASCVD: Condition codes only. CAC/CCTA Observation alone does not qualify. */
  exists ( [Condition: "AtheroscleroticCardiovascularDisease"] C
      where exists ( C.clinicalStatus.coding CS where CS.code ~ 'active' )
  )

define HasDiabetesMellitus:
  exists ( [Condition: "DiabetesMellitus"] C
      where exists ( C.clinicalStatus.coding CS where CS.code ~ 'active' )
  )
    or exists ( [Condition: "DiabetesMellitusType2"] C
        where exists ( C.clinicalStatus.coding CS where CS.code ~ 'active' )
    )

define EffectiveDiabetes:
  Coalesce(OverrideHasDiabetes, OpenCVDRisk.EffectiveDiabetes, HasDiabetesMellitus)

define HasHivInfection:
  exists ( [Condition: "HIVInfection"] C
      where exists ( C.clinicalStatus.coding CS where CS.code ~ 'active' )
  )

define HasEskd:
  exists ( [Condition: "EndStageKidneyDisease"] C
      where exists ( C.clinicalStatus.coding CS where CS.code ~ 'active' )
  )

define HasHfrefCondition:
  exists ( [Condition: "HeartFailureWithReducedEjectionFraction"] C
      where exists ( C.clinicalStatus.coding CS where CS.code ~ 'active' )
  )

define HasInheritedDyslipidemiaCondition:
  exists ( [Condition: "InheritedCardiovascularCondition"] C
      where exists ( C.clinicalStatus.coding CS where CS.code ~ 'active' )
  )

define LatestLvefPercent:
  OpenCVDRisk.LatestLvefPercent

define HasHfrefLvefLe35:
  LatestLvefPercent is not null and LatestLvefPercent <= 35.0

define LatestLdlMgDl:
  Coalesce(OverrideLdlMgDl, OpenCVDRisk.LatestLdlMgDl)

define OpenCVDRiskTenYearTotalCvdPercent:
  Coalesce(OverrideTenYearTotalCvdPercent, OpenCVDRisk.TenYearTotalCvdPercent)

define SelectedPreventModel:
  OpenCVDRisk.SelectedPreventModel

define ActiveStatinTherapy:
  OpenCVDRisk.ActiveStatinTherapy

define function MedicationRequestDrugConcept(request FHIR.MedicationRequest):
  case
    when request.medication is FHIR.CodeableConcept then request.medication as FHIR.CodeableConcept
    when request.medication is FHIR.Reference then First([Medication] Med
        where Med.id = Last(Split((request.medication as FHIR.Reference).reference, '/'))
    ).code
    else null end

define ActiveEzetimibeTherapy:
  exists ( [MedicationRequest] MR
      where MR.status in { 'active', 'on-hold' }
        and MedicationRequestDrugConcept(MR) in "EzetimibeTherapy"
  )

define ActivePcsk9Therapy:
  exists ( [MedicationRequest] MR
      where MR.status in { 'active', 'on-hold' }
        and MedicationRequestDrugConcept(MR) in "Pcsk9MonoclonalAntibodyTherapy"
  )

define ActiveBempedoicAcidTherapy:
  exists ( [MedicationRequest] MR
      where MR.status in { 'active', 'on-hold' }
        and MedicationRequestDrugConcept(MR) in "BempedoicAcidTherapy"
  )

define ActiveFibrateTherapy:
  exists ( [MedicationRequest] MR
      where MR.status in { 'active', 'on-hold' }
        and MedicationRequestDrugConcept(MR) in "FibrateTherapy"
  )

define ActiveIcosapentEthylTherapy:
  exists ( [MedicationRequest] MR
      where MR.status in { 'active', 'on-hold' }
        and MedicationRequestDrugConcept(MR) in "IcosapentEthylTherapy"
  )

define EffectiveOnLipidLoweringTherapy:
  Coalesce(
    OnLipidLoweringTherapy,
    ActiveStatinTherapy or ActiveEzetimibeTherapy or ActivePcsk9Therapy or ActiveBempedoicAcidTherapy
  )

define LatestTriglycerideObservation:
  First([Observation: "Triglycerides"] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.effective is not null
        and O.value is FHIR.Quantity
      sort by start of effective desc)

define LatestTriglycerideMgDl:
  case
    when LatestTriglycerideObservation is null then null
    else FHIRHelpers.ToQuantity(LatestTriglycerideObservation.value as FHIR.Quantity).value
  end

define LatestLipoproteinAObservation:
  First([Observation: "LipoproteinA"] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.effective is not null
      sort by start of effective desc)

define HasLipoproteinAResult:
  LatestLipoproteinAObservation is not null

define LatestAstObservation:
  First([Observation: "AspartateAminotransferase"] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.effective is not null
        and O.value is FHIR.Quantity
      sort by start of effective desc)

define LatestAltObservation:
  First([Observation: "AlanineAminotransferase"] O
      where O.status in { 'final', 'amended', 'corrected' }
        and O.effective is not null
        and O.value is FHIR.Quantity
      sort by start of effective desc)

define HasBaselineAstOrAlt:
  LatestAstObservation is not null or LatestAltObservation is not null

define LatestCacScore:
  OpenCVDRisk.LatestCacScore

define HasTriglyceridesGe150:
  LatestTriglycerideMgDl is not null and LatestTriglycerideMgDl >= 150.0

define HasTriglyceridesGt500:
  LatestTriglycerideMgDl is not null and LatestTriglycerideMgDl > 500.0

/* Chart/condition exclusions excluding the Box 3 life-expectancy branch (which routes to Box 4). */
define OutsideGuidelinePopulationHard:
  HasHfrefLvefLe35
    or HasHfrefCondition
    or HasEskd
    or HasInheritedDyslipidemiaCondition
    or HasTriglyceridesGt500

define OutsideGuidelinePopulation:
  OutsideGuidelinePopulationHard
    or (LifeExpectancyLimitedUnder5Years is true)

define GuidelinePopulationStatus:
  case
    when not IsAdult then 'NotAdult'
    when OutsideGuidelinePopulation then 'OutsidePopulation'
    else 'InScope'
  end

define PrimaryPreventionStatinIndicationBox8:
  EffectiveDiabetes is true
    or ( LatestLdlMgDl is not null and LatestLdlMgDl >= 190.0 )
    or ( OpenCVDRiskTenYearTotalCvdPercent is not null and OpenCVDRiskTenYearTotalCvdPercent >= 10.0 )

/* True when Box 8 is taken via DM or LDL ≥190 while PREVENT 10-year risk is unavailable. */
define Box8UsedNullPreventRisk:
  PrimaryPreventionStatinIndicationBox8
    and OpenCVDRiskTenYearTotalCvdPercent is null
    and (
      EffectiveDiabetes is true
        or ( LatestLdlMgDl is not null and LatestLdlMgDl >= 190.0 )
    )

define PrimaryPreventionBorderlineRiskBand:
  not PrimaryPreventionStatinIndicationBox8
    and not HasHivInfection
    and OpenCVDRiskTenYearTotalCvdPercent is not null
    and OpenCVDRiskTenYearTotalCvdPercent >= 5.0
    and OpenCVDRiskTenYearTotalCvdPercent < 10.0
    and ( LatestLdlMgDl is null or LatestLdlMgDl < 190.0 )
    and not (EffectiveDiabetes is true)

define VeryHighRiskCriterion3AscvdLdlOnTherapy:
  HasEstablishedCvd
    and LatestLdlMgDl is not null
    and LatestLdlMgDl >= 70.0
    and EffectiveOnLipidLoweringTherapy is true

define VeryHighRiskCvd:
  (VeryHighRiskRecentAcsOrMiOnTherapy is true)
    or (VeryHighRiskRecurrentEventsOnTherapy is true)
    or VeryHighRiskCriterion3AscvdLdlOnTherapy

define VeryHighRiskNeedsInput:
  HasEstablishedCvd
    and not (VeryHighRiskCvd)
    and (
      VeryHighRiskRecentAcsOrMiOnTherapy is null
        or VeryHighRiskRecurrentEventsOnTherapy is null
        or OnLipidLoweringTherapy is null
        or (
          LatestLdlMgDl is not null
            and LatestLdlMgDl >= 70.0
            and EffectiveOnLipidLoweringTherapy is null
        )
    )

define ChartSuggestsRecentIndexEvent:
  exists ( [Condition: "MiAcsCabgPci"] C
      where exists ( C.clinicalStatus.coding CS where CS.code ~ 'active' )
  )
    or exists ( [Procedure: "MiAcsCabgPci"] P
        where P.status = 'completed'
    )

/* Nullable: unknown must not default to false (Box 6 / Rec 24 clinician confirmation). */
define EffectiveRecentMiAcsOrCabgPciWithin6Weeks:
  RecentMiAcsOrCabgPciWithin6Weeks

define ShouldDiscussCardiacRehabReferral:
  HasEstablishedCvd and RecentMiAcsOrCabgPciWithin6Weeks is true

define AlgorithmNeedsClinicalInput:
  IsAdult
    and not OutsideGuidelinePopulationHard
    and (
      LifeExpectancyLimitedUnder5Years is null
        or (
          LifeExpectancyLimitedUnder5Years is false
            and HasEstablishedCvd
            and VeryHighRiskNeedsInput
        )
        or (
          LifeExpectancyLimitedUnder5Years is false
            and HasEstablishedCvd
            and VeryHighRiskCvd
            and EscalationNeeded is null
        )
        or (
          LifeExpectancyLimitedUnder5Years is false
            and not HasEstablishedCvd
            and not PrimaryPreventionStatinIndicationBox8
            and not HasHivInfection
            and PrimaryPreventionBorderlineRiskBand
            and BorderlineRiskPatientDesiresStatin is null
        )
    )

define AlgorithmStatus:
  case
    when not IsAdult then 'NotAdult'
    when OutsideGuidelinePopulationHard then 'OutsidePopulation'
    when LifeExpectancyLimitedUnder5Years is true then 'OutsidePopulation'
    when AlgorithmNeedsClinicalInput then 'NeedsClinicalInput'
    else 'Complete'
  end

define AlgorithmPath:
  case
    when not IsAdult then 'Box1_NotAdultOutsideAlgorithm'
    when OutsideGuidelinePopulationHard then 'OutsideGuidelinePopulation'
    when LifeExpectancyLimitedUnder5Years is null then 'NeedsClinicalInput_LifeExpectancy'
    when LifeExpectancyLimitedUnder5Years then 'Box4_DiscussUncertainBenefitLimitedLifeExpectancy'
    when HasEstablishedCvd and VeryHighRiskNeedsInput then 'NeedsClinicalInput_VeryHighRisk'
    when HasEstablishedCvd and VeryHighRiskCvd and EscalationNeeded is null then 'NeedsClinicalInput_Escalation'
    when HasEstablishedCvd and VeryHighRiskCvd and EscalationNeeded then 'Box19_SecondaryVeryHighRiskTripleTherapy'
    when HasEstablishedCvd and VeryHighRiskCvd then 'Box17_SecondaryVeryHighRiskInitialCombination'
    when HasEstablishedCvd then 'Box16_SecondaryStandardRiskThreeOptions'
    when PrimaryPreventionStatinIndicationBox8 then 'Box9_PrimaryAtLeastModerateStatinConsiderLipidSpecialistIfLdlGe190'
    when HasHivInfection then 'Box11_PrimaryModerateStatinHiv'
    when PrimaryPreventionBorderlineRiskBand and BorderlineRiskPatientDesiresStatin is null then 'NeedsClinicalInput_BorderlineDesire'
    when PrimaryPreventionBorderlineRiskBand and BorderlineRiskPatientDesiresStatin then 'Box11_PrimaryModerateStatinBorderlineRiskPatientPreference'
    when not HasEstablishedCvd
      and not PrimaryPreventionStatinIndicationBox8
      and not HasHivInfection
      and ( not PrimaryPreventionBorderlineRiskBand or BorderlineRiskPatientDesiresStatin is false )
      then 'Box13_14_NoMedicationRepeatRiskEvery5YearsUnlessNewRiskFactors'
    else 'NeedsClinicalInput'
  end

define ShowComprehensiveLifestyleReminder:
  IsAdult

define ShowReemphasizeLifestyleReminder:
  AlgorithmPath in {
    'Box9_PrimaryAtLeastModerateStatinConsiderLipidSpecialistIfLdlGe190',
    'Box11_PrimaryModerateStatinHiv',
    'Box11_PrimaryModerateStatinBorderlineRiskPatientPreference',
    'Box13_14_NoMedicationRepeatRiskEvery5YearsUnlessNewRiskFactors',
    'Box16_SecondaryStandardRiskThreeOptions',
    'Box17_SecondaryVeryHighRiskInitialCombination',
    'Box19_SecondaryVeryHighRiskTripleTherapy'
  }

define ShowBox15ReassessReminder:
  AlgorithmPath in {
    'Box9_PrimaryAtLeastModerateStatinConsiderLipidSpecialistIfLdlGe190',
    'Box11_PrimaryModerateStatinHiv',
    'Box11_PrimaryModerateStatinBorderlineRiskPatientPreference'
  }

define ShowBox20MonitoringReminder:
  AlgorithmPath in {
    'Box16_SecondaryStandardRiskThreeOptions',
    'Box17_SecondaryVeryHighRiskInitialCombination',
    'Box19_SecondaryVeryHighRiskTripleTherapy'
  }

define ActiveBox1: true
define ActiveBox2: IsAdult
define ActiveBox3: IsAdult and not OutsideGuidelinePopulationHard
define ActiveBox4: AlgorithmPath = 'Box4_DiscussUncertainBenefitLimitedLifeExpectancy'
define ActiveBox5: IsAdult and LifeExpectancyLimitedUnder5Years is false
define ActiveBox6: HasEstablishedCvd and LifeExpectancyLimitedUnder5Years is false
define ActiveBox7: HasEstablishedCvd and LifeExpectancyLimitedUnder5Years is false
define ActiveBox8: IsAdult and LifeExpectancyLimitedUnder5Years is false and not HasEstablishedCvd
define ActiveBox9: AlgorithmPath = 'Box9_PrimaryAtLeastModerateStatinConsiderLipidSpecialistIfLdlGe190'
define ActiveBox10: ActiveBox8 and not PrimaryPreventionStatinIndicationBox8
define ActiveBox11: AlgorithmPath in {
  'Box11_PrimaryModerateStatinHiv',
  'Box11_PrimaryModerateStatinBorderlineRiskPatientPreference'
}
define ActiveBox12: PrimaryPreventionBorderlineRiskBand
define ActiveBox13: AlgorithmPath = 'Box13_14_NoMedicationRepeatRiskEvery5YearsUnlessNewRiskFactors'
define ActiveBox14: AlgorithmPath = 'Box13_14_NoMedicationRepeatRiskEvery5YearsUnlessNewRiskFactors'
define ActiveBox15: ShowBox15ReassessReminder
define ActiveBox16: AlgorithmPath = 'Box16_SecondaryStandardRiskThreeOptions'
define ActiveBox17: AlgorithmPath in {
  'Box17_SecondaryVeryHighRiskInitialCombination',
  'NeedsClinicalInput_Escalation',
  'Box19_SecondaryVeryHighRiskTripleTherapy'
}
define ActiveBox18: AlgorithmPath in {
  'NeedsClinicalInput_Escalation',
  'Box17_SecondaryVeryHighRiskInitialCombination',
  'Box19_SecondaryVeryHighRiskTripleTherapy'
}
define ActiveBox19: AlgorithmPath = 'Box19_SecondaryVeryHighRiskTripleTherapy'
define ActiveBox20: ShowBox20MonitoringReminder
define ActiveBox21: ShowReemphasizeLifestyleReminder

/* --- Recommendation applicability (flat strings for $evaluate) --- */

define Rec01Status:
  case
    when not IsAdult then 'NotApplicable'
    when HasEstablishedCvd then 'NotApplicable'
    else 'Applicable'
  end

define Rec02Status:
  case
    when not IsAdult then 'NotApplicable'
    when HasEstablishedCvd then 'NotApplicable'
    when ActiveStatinTherapy then 'NotApplicable'
    else 'Informational'
  end

define Rec03Status:
  case
    when not IsAdult or HasEstablishedCvd then 'NotApplicable'
    when ClinicalRiskIntermediateOrHigh is null or CacWouldChangeManagement is null then 'NeedsClinicalInput'
    when ClinicalRiskIntermediateOrHigh and CacWouldChangeManagement then 'Applicable'
    else 'NotApplicable'
  end

define Rec04Status:
  case
    when not IsAdult or HasEstablishedCvd then 'NotApplicable'
    when ClinicalRiskLow is null then 'NeedsClinicalInput'
    when ClinicalRiskLow then 'Applicable'
    else 'NotApplicable'
  end

define Rec05Status:
  case
    when not IsAdult then 'NotApplicable'
    else 'Applicable'
  end

define Rec06Status: 'Informational'

define Rec07Status:
  case
    when not IsAdult or HasEstablishedCvd then 'NotApplicable'
    when PrimaryPreventionStatinIndicationBox8 then 'Applicable'
    else 'NotApplicable'
  end

define Rec08Status:
  case
    when not IsAdult or HasEstablishedCvd then 'NotApplicable'
    when PrimaryPreventionBorderlineRiskBand then 'Applicable'
    else 'NotApplicable'
  end

define Rec09Status:
  case
    when not IsAdult or HasEstablishedCvd then 'NotApplicable'
    else 'Informational'
  end

define Rec10Status:
  case
    when not IsAdult or HasEstablishedCvd then 'NotApplicable'
    when HasHivInfection then 'Applicable'
    else 'NotApplicable'
  end

define Rec11Status:
  case
    when not IsAdult then 'NotApplicable'
    when not (PrimaryPreventionStatinIndicationBox8 or HasEstablishedCvd or HasHivInfection or PrimaryPreventionBorderlineRiskBand) then 'NotApplicable'
    when AstAltLessThan3xUlnConfirmed is true then 'Applicable'
    when HasBaselineAstOrAlt and AstAltLessThan3xUlnConfirmed is null then 'NeedsClinicalInput'
    when AstAltLessThan3xUlnConfirmed is null then 'NeedsClinicalInput'
    else 'NotApplicable'
  end

define Rec12Status:
  case
    when ActiveFibrateTherapy and ActiveStatinTherapy then 'Applicable'
    else 'Informational'
  end

define Rec13Status:
  case
    when HasEstablishedCvd and not VeryHighRiskCvd and not VeryHighRiskNeedsInput then 'Applicable'
    when HasEstablishedCvd and VeryHighRiskNeedsInput then 'NeedsClinicalInput'
    else 'NotApplicable'
  end

define Rec14Status:
  case
    when HasEstablishedCvd and VeryHighRiskCvd then 'Applicable'
    when HasEstablishedCvd and VeryHighRiskNeedsInput then 'NeedsClinicalInput'
    else 'NotApplicable'
  end

define Rec15Status:
  case
    when LatestLdlMgDl is not null and LatestLdlMgDl < 30.0
      and (ActiveStatinTherapy or ActiveEzetimibeTherapy or ActivePcsk9Therapy or ActiveBempedoicAcidTherapy)
      then 'Applicable'
    else 'NotApplicable'
  end

define Rec16Status:
  case
    when not HasEstablishedCvd then 'NotApplicable'
    when not ActiveStatinTherapy then 'NotApplicable'
    when PersistentlyElevatedFastingTriglycerides is true then 'Applicable'
    when HasTriglyceridesGe150 and PersistentlyElevatedFastingTriglycerides is null then 'NeedsClinicalInput'
    else 'NotApplicable'
  end

define Rec17Status:
  case
    when HasEstablishedCvd then 'Informational'
    else 'NotApplicable'
  end

define Rec18Status:
  case
    when StatinIntoleranceAttested is true then 'Applicable'
    when StatinIntoleranceAttested is false then 'NotApplicable'
    else 'Informational'
  end

define Rec19Status:
  case
    when UnableToTakeStatin is true then 'Applicable'
    when UnableToTakeStatin is false then 'NotApplicable'
    else 'Informational'
  end

define Rec20Status: 'Informational'

define Rec21Status: 'Applicable'

define Rec22Status:
  case when IsAdult then 'Applicable' else 'NotApplicable' end

define Rec23Status:
  case when IsAdult then 'Applicable' else 'NotApplicable' end

/* Rec 24: broader “recent CHD” than Box 6’s six-week cue; chart index event or clinician Yes. */
define Rec24Status:
  case
    when not HasEstablishedCvd then 'NotApplicable'
    when RecentMiAcsOrCabgPciWithin6Weeks is true then 'Applicable'
    when ChartSuggestsRecentIndexEvent then 'Applicable'
    when RecentMiAcsOrCabgPciWithin6Weeks is null then 'NeedsClinicalInput'
    else 'NotApplicable'
  end

define ExclusionHfrefLvefLe35: HasHfrefLvefLe35
define ExclusionHfrefCondition: HasHfrefCondition
define ExclusionEskd: HasEskd
define ExclusionInheritedDyslipidemia: HasInheritedDyslipidemiaCondition
define ExclusionTriglyceridesGt500: HasTriglyceridesGt500
define ExclusionLifeExpectancyUnder5Years: LifeExpectancyLimitedUnder5Years is true

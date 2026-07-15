/*
  VA/DoD Clinical Practice Guideline on Lipid Management for Cardiovascular Disease Risk Reduction (2025).
  Management algorithm (Appendix G narrative; figure page 20): adult pathway, life expectancy, secondary vs primary
  prevention, AHA PREVENT™ (via OpenCVDRisk) 10-year total CVD risk thresholds (5% to <10% with patient preference,
  >=10% with other indications), HIV branch, and no-medication repeat-risk (Boxes 13-14) when Box 8/10/12 are all No.

  10-year risk: see OpenCVDRisk (`OpenCVDRiskTenYearTotalCvdPercent` = OpenCVDRisk total CVD 10y probability x100;
  guideline narrative and Table 4 refer to AHA PREVENT™ CV / estimated risk; confirm endpoint vs local policy if
  ASCVD-only is required). OpenCVDRisk is an open-source implementation of the AHA PREVENT™ algorithms and is not
  affiliated with or endorsed by the AHA.

  OpenCVDRisk returns null outside ages 30-79 or when required labs/BMI/creatinine are missing; Box 8 then relies on
  DM and LDL-C only.

  CDS outputs are not treatment orders. Host systems must supply life expectancy and borderline treatment
  preference where appropriate (parameters below).

  Author: Preston Lee (original scaffolding); algorithm mapping per December 2025 CPG.
*/
library LipidManagement version '0.0.5'

using FHIR version '4.0.1'

include FHIRHelpers version '4.0.1'
include OpenCVDRisk version '0.3.0' called OpenCVDRisk

codesystem "SNOMED": 'http://snomed.info/sct'
codesystem "ICD10CM": 'http://hl7.org/fhir/sid/icd-10-cm'

valueset "AtheroscleroticCardiovascularDisease": 'http://cts.nlm.nih.gov/fhir/ValueSet/2.16.840.1.113762.1.4.1178.149'
valueset "DiabetesMellitusType2": 'https://asu.edu/fhir/ValueSet/diabetes-mellitus-type-2'

parameter LifeExpectancyLimited Boolean default false
parameter BorderlineRiskPatientDesiresStatin Boolean default false

context Patient

/* --- Appendix G spine + figure box numbers (VA/DoD Lipids 2025) --- */


define IsAdult:
  AgeInYears() >= 18

define HasEstablishedCvd:
  exists ( [Condition: "AtheroscleroticCardiovascularDisease"] C
      where exists ( C.clinicalStatus.coding CS
          where CS.code ~ 'active'
      )
  )

define HasType2Diabetes:
  exists ( [Condition: "DiabetesMellitusType2"] C
      where exists ( C.clinicalStatus.coding CS
          where CS.code ~ 'active'
      )
  )

define HasHivInfection:
  exists ( [Condition] C
      where exists ( C.code.coding CD
          where ( ( CD.system.value = "SNOMED".id
                and CD.code.value in { '86406008', '165816005', '165817001' }
            )
              or ( CD.system.value = "ICD10CM".id
                  and CD.code.value is not null
                  and ( PositionOf('B20', CD.code.value) = 0
                      or PositionOf('Z21', CD.code.value) = 0
                  )
              )
          )
      )
        and exists ( C.clinicalStatus.coding CS
            where CS.code ~ 'active'
        )
  )

define LatestLdlMgDl:
  OpenCVDRisk.LatestLdlMgDl

define OpenCVDRiskTenYearTotalCvdPercent:
  OpenCVDRisk.TenYearTotalCvdPercent

define PrimaryPreventionStatinIndicationBox8:
  HasType2Diabetes
    or ( LatestLdlMgDl is not null
        and LatestLdlMgDl >= 190.0
    )
    or ( OpenCVDRiskTenYearTotalCvdPercent is not null
        and OpenCVDRiskTenYearTotalCvdPercent >= 10.0
    )

define PrimaryPreventionBorderlineRiskBand:
  not PrimaryPreventionStatinIndicationBox8
    and not HasHivInfection
    and OpenCVDRiskTenYearTotalCvdPercent is not null
    and OpenCVDRiskTenYearTotalCvdPercent >= 5.0
    and OpenCVDRiskTenYearTotalCvdPercent < 10.0

/* Appendix G: Box 8 No -> Box 10 No -> Box 12 No -> Boxes 13-14 (AHA PREVENT™ via OpenCVDRisk <5%, null risk, or 5-<10% without patient desire). */
define PrimaryPreventionBoxes13To14Path:
  not HasEstablishedCvd
    and not PrimaryPreventionStatinIndicationBox8
    and not HasHivInfection
    and ( not PrimaryPreventionBorderlineRiskBand
        or not BorderlineRiskPatientDesiresStatin
    )

define VeryHighRiskCvdSidebar4Proxy:
  HasEstablishedCvd
    and LatestLdlMgDl is not null
    and LatestLdlMgDl >= 70.0

/* Algorithm box 6 (cardiac rehab within 6 weeks of MI/ACS/CABG/PCI): requires precise procedure dating - host override recommended. */

define RecentMiAcsOrCabgPciWithin6Weeks:
  false

define ShouldDiscussCardiacRehabReferral:
  false

/*
  Terminal / branch labels aligned to algorithm boxes 4,9,11,13-21,16-20.
  Secondary-prevention treatment choice (boxes 16-19) is summarized as intensity tiers, not a medication order.
*/


define LipidManagementAlgorithmPath:
  case
    when not IsAdult then 'Box1_NotAdultOutsideAlgorithm'
    when LifeExpectancyLimited then 'Box4_DiscussUncertainBenefitLimitedLifeExpectancy'
    when HasEstablishedCvd
      and VeryHighRiskCvdSidebar4Proxy then 'Box17_18_19_SecondaryVeryHighRiskEscalationConsiderTripleTherapy'
    when HasEstablishedCvd then 'Box16_20_SecondaryStandardRiskHighOrModerateStatinCombinationOptions'
    when PrimaryPreventionStatinIndicationBox8 then 'Box9_PrimaryAtLeastModerateStatinConsiderLipidSpecialistIfLdlGe190'
    when HasHivInfection then 'Box11_PrimaryModerateStatinHiv'
    when PrimaryPreventionBorderlineRiskBand
      and BorderlineRiskPatientDesiresStatin then 'Box11_PrimaryModerateStatinBorderlineRiskPatientPreference'
    when PrimaryPreventionBoxes13To14Path then 'Box13_14_NoMedicationRepeatRiskEvery5YearsUnlessNewRiskFactors'
    /* Appendix G: all classified primary/secondary branches above; this else should not run for the published spine. */
    else 'Box21_ReinforceComprehensiveLifestyleMedication'
  end

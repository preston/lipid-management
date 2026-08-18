// Author: Preston Lee

import type { RiskCalculatorSession } from '../../services/risk-calculator-session.service';
import type {
  GuidelineClinicianAnswers,
  GuidelineEvaluationView,
} from './guideline.model';

function isoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : value;
}

function withDate(label: string, date: string | null | undefined): string {
  const day = isoDate(date);
  return day ? `${label} (${day})` : label;
}

function joinBlurb(parts: Array<string | null | undefined>): string | null {
  const kept = parts.map((part) => part?.trim()).filter((part): part is string => !!part);
  return kept.length ? kept.join(' · ') : null;
}

function sessionDate(session: RiskCalculatorSession | null): string | null {
  return isoDate(session?.calculatedAt);
}

function diabetesFlag(
  view: GuidelineEvaluationView | null,
  session: RiskCalculatorSession | null,
): boolean | null {
  if (view?.effectiveDiabetes != null) {
    return view.effectiveDiabetes;
  }
  return session?.effectiveDiabetes ?? null;
}

function tenYearPercent(
  view: GuidelineEvaluationView | null,
  session: RiskCalculatorSession | null,
): number | null {
  return view?.tenYearTotalCvdPercent ?? session?.tenYearTotalCvdPercent ?? null;
}

function ldlMgDl(
  view: GuidelineEvaluationView | null,
  session: RiskCalculatorSession | null,
): number | null {
  return view?.latestLdlMgDl ?? session?.effectiveLdlMgDl ?? null;
}

function ldlBlurb(
  view: GuidelineEvaluationView | null,
  session: RiskCalculatorSession | null,
): string | null {
  const ldl = ldlMgDl(view, session);
  if (ldl == null) {
    return null;
  }
  return withDate(`LDL-C ${Math.round(ldl)} mg/dL`, view?.chartEvidence.latestLdlDate);
}

function establishedCvdBlurb(view: GuidelineEvaluationView | null): string | null {
  if (!view) {
    return null;
  }
  return (
    view.chartEvidence.establishedCvd ??
    (view.hasEstablishedCvd ? 'ASCVD' : 'No ASCVD or CABG/PCI on file')
  );
}

function hivBlurb(view: GuidelineEvaluationView | null): string | null {
  if (!view) {
    return null;
  }
  return view.chartEvidence.hivInfection ?? (view.hasHivInfection ? 'Active HIV' : 'No active HIV on file');
}

export function formatQuestionEvidence(
  id: keyof GuidelineClinicianAnswers,
  view: GuidelineEvaluationView | null,
  session: RiskCalculatorSession | null,
): string | null {
  const when = sessionDate(session);
  switch (id) {
    case 'lifeExpectancyLimitedUnder5Years':
      return session?.preventLifeExpectancyLimited ? withDate('PREVENT <1 y', when) : null;
    case 'establishedCvd':
      return establishedCvdBlurb(view);
    case 'hivInfection':
      return hivBlurb(view);
    case 'primaryPreventionStatinIndication': {
      const diabetes = diabetesFlag(view, session);
      const risk = tenYearPercent(view, session);
      return joinBlurb([
        diabetes === true ? (view?.chartEvidence.diabetes ?? 'DM') : diabetes === false ? 'no DM' : null,
        ldlBlurb(view, session),
        risk != null ? withDate(`10y ${risk.toFixed(1)}%`, when) : null,
      ]);
    }
    case 'borderlineRiskBand': {
      const risk = tenYearPercent(view, session);
      return risk != null ? withDate(`10y ${risk.toFixed(1)}%`, when) : null;
    }
    case 'onLipidLoweringTherapy':
      return view?.chartEvidence.lipidLoweringTherapy ?? null;
    case 'veryHighRiskCvd': {
      if (view?.veryHighRiskCvd !== true) {
        return null;
      }
      const ldl = ldlMgDl(view, session);
      return joinBlurb([
        view.chartEvidence.lipidLoweringTherapy,
        ldl != null && ldl >= 70 ? ldlBlurb(view, session) : null,
        view.chartEvidence.chartIndexEvent,
      ]);
    }
    case 'veryHighRiskRecentAcsOrMiOnTherapy':
    case 'veryHighRiskRecurrentEventsOnTherapy':
      return joinBlurb([
        view?.chartEvidence.lipidLoweringTherapy,
        view?.chartEvidence.chartIndexEvent,
      ]);
    case 'recentMiAcsOrCabgPciWithin6Weeks':
      return view?.chartEvidence.chartIndexEvent ?? null;
    case 'persistentlyElevatedFastingTriglycerides':
      return view?.chartEvidence.triglycerides ?? null;
    case 'elevatedAstOrAltLessThan3xUln':
      return view?.chartEvidence.astAlt ?? null;
    default:
      return null;
  }
}

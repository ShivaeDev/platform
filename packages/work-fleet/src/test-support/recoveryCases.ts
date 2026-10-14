import { recoveryActiveTurnCase } from "#test/recoveryActiveTurnCase.ts";
import { recoveryAdmissionCases } from "#test/recoveryAdmissionCases.ts";
import { recoveryAdoptionCases } from "#test/recoveryAdoptionCases.ts";
import { recoveryBoardReportCases } from "#test/recoveryBoardReportCases.ts";
import { recoveryBoundaryCases } from "#test/recoveryBoundaryCases.ts";
import { recoveryCheckRepairCase } from "#test/recoveryCheckRepairCase.ts";
import { recoveryChecksCases } from "#test/recoveryChecksCases.ts";
import { recoveryConflictCase } from "#test/recoveryConflictCase.ts";
import { recoveryDeliveryCases } from "#test/recoveryDeliveryCases.ts";
import { recoveryFallbackCases } from "#test/recoveryFallbackCases.ts";
import { recoveryGithubDeliveryCases } from "#test/recoveryGithubDeliveryCases.ts";
import { recoveryHostCases } from "#test/recoveryHostCases.ts";
import { recoveryIntegrationCases } from "#test/recoveryIntegrationCases.ts";
import { recoveryJournalCases } from "#test/recoveryJournalCases.ts";
import { recoveryPreparationCases } from "#test/recoveryPreparationCases.ts";
import { recoveryProducerCases } from "#test/recoveryProducerCases.ts";
import { recoveryProviderCases } from "#test/recoveryProviderCases.ts";
import { recoveryReadCase } from "#test/recoveryReadCase.ts";
import { recoveryRecordCases } from "#test/recoveryRecordCases.ts";
import { recoveryReportCases } from "#test/recoveryReportCases.ts";
import { recoveryReviewCases } from "#test/recoveryReviewCases.ts";
import { recoveryScopeCases } from "#test/recoveryScopeCases.ts";
import { recoveryUncertainCases } from "#test/recoveryUncertainCases.ts";
import { recoveryWorkerCases } from "#test/recoveryWorkerCases.ts";

export function recoveryCases() {
	return [
		recoveryReadCase(),
		recoveryActiveTurnCase("session-active-turn"),
		recoveryActiveTurnCase("session-active-turn-exhausted"),
		...recoveryFallbackCases(),
		...recoveryScopeCases(),
		...recoveryAdmissionCases(),
		...recoveryRecordCases(),
		...recoveryBoundaryCases(),
		...recoveryHostCases(),
		...recoveryProducerCases(),
		...recoveryProviderCases(),
		...recoveryJournalCases(),
		...recoveryChecksCases(),
		recoveryCheckRepairCase(),
		recoveryConflictCase(),
		...recoveryGithubDeliveryCases(),
		...recoveryAdoptionCases(),
		...recoveryPreparationCases,
		...recoveryWorkerCases(),
		...recoveryUncertainCases(),
		...recoveryReviewCases,
		...recoveryReportCases(),
		...recoveryBoardReportCases(),
		...recoveryDeliveryCases(),
		...recoveryIntegrationCases(),
	];
}

import { recoveryAdoptionCases } from "#test/recoveryAdoptionCases.ts";
import { recoveryBoundaryCases } from "#test/recoveryBoundaryCases.ts";
import { recoveryChecksCases } from "#test/recoveryChecksCases.ts";
import { recoveryDeliveryCases } from "#test/recoveryDeliveryCases.ts";
import { recoveryGithubDeliveryCases } from "#test/recoveryGithubDeliveryCases.ts";
import { recoveryIntegrationCases } from "#test/recoveryIntegrationCases.ts";
import { recoveryPreparationCases } from "#test/recoveryPreparationCases.ts";
import { recoveryRecordCases } from "#test/recoveryRecordCases.ts";
import { recoveryReportCases } from "#test/recoveryReportCases.ts";
import { recoveryReviewCases } from "#test/recoveryReviewCases.ts";
import { recoveryScopeCases } from "#test/recoveryScopeCases.ts";
import { recoveryUncertainCases } from "#test/recoveryUncertainCases.ts";
import { recoveryWorkerCases } from "#test/recoveryWorkerCases.ts";

export function recoveryCases() {
	return [
		...recoveryScopeCases(),
		...recoveryRecordCases(),
		...recoveryBoundaryCases(),
		...recoveryChecksCases(),
		...recoveryGithubDeliveryCases(),
		...recoveryAdoptionCases(),
		...recoveryPreparationCases,
		...recoveryWorkerCases(),
		...recoveryUncertainCases(),
		...recoveryReviewCases,
		...recoveryReportCases(),
		...recoveryDeliveryCases(),
		...recoveryIntegrationCases(),
	];
}

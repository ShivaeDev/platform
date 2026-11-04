import { createCheckRun } from "#operations/createCheckRun.ts";
import { findLatestCheckRun } from "#operations/findLatestCheckRun.ts";
import { updateCheckRun } from "#operations/updateCheckRun.ts";
import { upsertCheckRun } from "#operations/upsertCheckRun.ts";
import type { Representations } from "#representations.ts";

export function checkRuns(client: Representations) {
	return {
		createCheckRun: createCheckRun(client),
		findLatestCheckRun: findLatestCheckRun(client),
		updateCheckRun: updateCheckRun(client),
		upsertCheckRun: upsertCheckRun(client),
	};
}

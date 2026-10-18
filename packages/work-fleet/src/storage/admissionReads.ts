import { acquires } from "#storage/admission.ts";
import type { FleetStoreOptions } from "#storage/FleetStoreOptions.ts";
import type { AdmissionLimits } from "#storage/model.ts";

export function admissionReads<A>(options: FleetStoreOptions<A>, record: A, previous: A | undefined, limits: AdmissionLimits) {
	const executing = acquires(options.executing, record, previous);
	const capacity =
		(limits.maxExecuting !== undefined && options.executing !== undefined && executing)
		|| (limits.maxBacklog !== undefined && options.backlog !== undefined && (executing || acquires(options.backlog, record, previous)));
	const quota =
		limits.quota !== undefined
		&& options.submissions !== undefined
		&& (previous === undefined || !(options.submissions(record, limits.quota.observedAt) <= options.submissions(previous, limits.quota.observedAt)));
	const admission = options.admission !== undefined && (options.admissionNeedsRecords?.(record, previous, limits) ?? true);
	return { foreign: admission || capacity, records: admission || capacity || quota };
}

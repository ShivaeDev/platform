import type { Effect } from "effect";
import type { StorageAdmission } from "#storage/errors.ts";
import type { AdmissionLimits } from "#storage/model.ts";

export interface FleetStoreOptions<A> {
	readonly admission?: (record: A, previous: A | undefined, records: readonly A[], limits: AdmissionLimits) => Effect.Effect<void, StorageAdmission>;
	readonly admissionNeedsRecords?: (record: A, previous: A | undefined, limits: AdmissionLimits) => boolean;
	readonly backlog?: (record: A) => boolean;
	readonly executing?: (record: A) => boolean;
	readonly namespace?: string;
	readonly requeue?: (record: A, previous: A) => boolean;
	readonly submissions?: (record: A, since: number) => number;
}

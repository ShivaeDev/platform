import { Effect } from "effect";
import { StorageCapacity, StorageQuota } from "#storage/errors.ts";
import type { FleetStoreOptions } from "#storage/FleetStoreOptions.ts";
import type { AdmissionLimits, ForeignReservation, Versioned } from "#storage/model.ts";
export function acquires<A>(predicate: ((record: A) => boolean) | undefined, record: A, previous: A | undefined): boolean {
	return predicate?.(record) === true && (previous === undefined || !predicate(previous));
}

export const checkCapacity = Effect.fn("FleetStore.checkCapacity")(function* <A>(
	kind: "execution" | "backlog",
	limit: number | undefined,
	predicate: ((record: A) => boolean) | undefined,
	acquiring: boolean,
	others: readonly Versioned<A>[],
	external: number,
) {
	if (limit === undefined || predicate === undefined || !acquiring) {
		return;
	}
	const occupied = others.filter(({ value }) => predicate(value)).length + external;
	if (occupied >= limit) {
		return yield* Effect.fail(new StorageCapacity({ kind, limit }));
	}
});

export const checkQuota = Effect.fn("FleetStore.checkQuota")(function* <A>(
	quota: AdmissionLimits["quota"],
	submissions: ((record: A, since: number) => number) | undefined,
	record: A,
	previous: A | undefined,
	others: readonly Versioned<A>[],
) {
	if (quota === undefined) {
		return;
	}
	if (submissions === undefined) {
		return yield* Effect.fail(new StorageQuota({ ...quota, reason: "unconfigured" }));
	}
	const candidate = submissions(record, quota.observedAt);
	if (previous !== undefined && candidate <= submissions(previous, quota.observedAt)) {
		return;
	}
	const submitted = others.reduce((total, entry) => total + submissions(entry.value, quota.observedAt), candidate);
	if (submitted > quota.available) {
		return yield* Effect.fail(new StorageQuota({ ...quota, reason: "exhausted", submitted }));
	}
});

export const checkRecordAdmission = Effect.fn("FleetStore.checkRecordAdmission")(function* <A extends { readonly workId: string }>(
	options: FleetStoreOptions<A>,
	record: A,
	previous: A | undefined,
	entries: readonly Versioned<A>[],
	external: readonly ForeignReservation[],
	limits: AdmissionLimits,
) {
	yield* options.admission?.(
		record,
		previous,
		entries.map(({ value }) => value),
		limits,
	) ?? Effect.void;
	const others = entries.filter(({ value }) => value.workId !== record.workId);
	const acquiringExecution = acquires(options.executing, record, previous);
	yield* checkCapacity(
		"execution",
		limits.maxExecuting,
		options.executing,
		acquiringExecution,
		others,
		external.filter((entry) => entry.executing).length,
	);
	yield* checkCapacity(
		"backlog",
		limits.maxBacklog,
		options.backlog,
		acquiringExecution || acquires(options.backlog, record, previous),
		others,
		external.filter((entry) => entry.backlog).length,
	);
	yield* checkQuota(limits.quota, options.submissions, record, previous, others);
});

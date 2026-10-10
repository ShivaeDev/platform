import { Effect } from "effect";
import { StorageCapacity, StorageInvalidPath, StorageOwnershipConflict, StorageQuota } from "#storage/errors.ts";
import type { AdmissionLimits, Versioned } from "#storage/model.ts";
export function validatePaths(paths: readonly string[]) {
	return Effect.forEach(paths, (path) =>
		path !== "."
		&& (path.length === 0
			|| path.startsWith("/")
			|| path.includes("\\")
			|| path.split("/").some((part) => part === "" || part === "." || part === ".."))
			? Effect.fail(new StorageInvalidPath({ path }))
			: Effect.succeed(path),
	);
}

export function pathsOverlap(left: string, right: string): boolean {
	return left === "." || right === "." || left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

export function acquires<A>(predicate: ((record: A) => boolean) | undefined, record: A, previous: A | undefined): boolean {
	return predicate?.(record) === true && (previous === undefined || !predicate(previous));
}

export const checkOwnership = Effect.fn("FleetStore.checkOwnership")(function* (
	workId: string,
	paths: readonly string[],
	owners: readonly { readonly owner: string; readonly paths: readonly string[] }[],
) {
	for (const owner of owners) {
		const path = paths.find((candidate) => owner.paths.some((reserved) => pathsOverlap(candidate, reserved)));
		if (path !== undefined) {
			return yield* Effect.fail(new StorageOwnershipConflict({ owner: owner.owner, path, workId }));
		}
	}
});

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

export function ownedPaths<A>(
	record: A | undefined,
	owns: (record: A) => boolean,
	reservations: (record: A) => readonly string[],
): readonly string[] {
	return record === undefined || !owns(record) ? [] : reservations(record);
}

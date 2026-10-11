import { Effect } from "effect";
import type { FleetRepository } from "#engine/repository.ts";
import { allAttempts } from "#model.ts";

export const operationRecord = Effect.fn("Fleet.operationRecord")(function* (store: typeof FleetRepository.Service, operationId: string) {
	if (store.operationEntries === undefined) {
		const matches = (yield* store.list()).flatMap((record) =>
			allAttempts(record.value)
				.filter((attempt) => attempt.operationId === operationId)
				.map(() => record),
		);
		return matches.length === 1 ? matches[0] : undefined;
	}
	const entries = yield* store.operationEntries(operationId);
	const entry = entries.length === 1 ? entries[0] : undefined;
	const stored = entry === undefined ? undefined : yield* store.load(entry.workId);
	return stored !== undefined
		&& stored.version === entry?.version
		&& allAttempts(stored.value).filter((attempt) => attempt.operationId === operationId).length === 1
		? stored
		: undefined;
});

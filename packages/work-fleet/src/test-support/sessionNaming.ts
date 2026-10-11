import { Effect } from "effect";
import type { FleetRepository } from "#engine/repository.ts";
import type { FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";
import { namedAttempt, namedRecord } from "#test/namedCloudHost.ts";

export function sessionNaming(count: number) {
	const records = new Map<string, Versioned<FleetRecord>>(
		Array.from({ length: count }, (_, index) => {
			const workId = `synthetic-${index}`;
			return [workId, { value: namedRecord(workId, index === 0 ? [namedAttempt("worker")] : []), version: 1 }] as const;
		}),
	);
	const loads: string[] = [];
	let lists = 0;
	const store: typeof FleetRepository.Service = {
		compareAndSet: (workId, version, value) =>
			Effect.sync(() => {
				const stored = { value, version: version + 1 };
				records.set(workId, stored);
				return stored;
			}),
		foreignReservations: () => Effect.succeed([]),
		insert: (value) => Effect.succeed({ value, version: 1 }),
		list: () =>
			Effect.sync(() => {
				lists += 1;
				return [...records.values()];
			}),
		load: (workId) =>
			Effect.sync(() => {
				loads.push(workId);
				return records.get(workId);
			}),
		releaseForeign: () => Effect.void,
		reserveForeign: () => Effect.void,
	};
	return {
		lists: () => lists,
		loads,
		remove: () => records.delete("synthetic-0"),
		replace: (value: FleetRecord) => records.set("synthetic-0", { value, version: 2 }),
		store,
	};
}

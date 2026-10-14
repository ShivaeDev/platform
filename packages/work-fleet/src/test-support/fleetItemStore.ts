import { Effect } from "effect";
import type { FleetRepository } from "#engine/repository.ts";
import type { FleetRecord } from "#model.ts";
import { prepared } from "#test/preparation.ts";

export function itemRecord(stage: FleetRecord["stage"], overrides: Partial<FleetRecord> = {}): FleetRecord {
	return {
		attempts: [],
		boardRevision: "revision",
		cwd: "/synthetic",
		preparation: prepared(),
		prompt: "Synthetic work",
		stage,
		stageEnteredAt: 100,
		updatedAt: 200,
		workId: stage,
		...overrides,
	};
}
export function fleetItemStore(records: readonly FleetRecord[]): typeof FleetRepository.Service {
	return {
		compareAndSet: () => Effect.die("Unexpected store update"),
		foreignReservations: () => Effect.die("Unexpected reservation read"),
		hasLaunchRetry: () => Effect.die("Unexpected retry read"),
		insert: () => Effect.die("Unexpected store insert"),
		list: () => Effect.succeed(records.map((value) => ({ value, version: 1 }))),
		load: () => Effect.die("Unexpected store load"),
		releaseForeign: () => Effect.die("Unexpected reservation release"),
		reserveForeign: () => Effect.die("Unexpected reservation write"),
	};
}

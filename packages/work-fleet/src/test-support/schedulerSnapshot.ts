import { Effect } from "effect";
import { vi } from "vitest";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";

export const schedulerSnapshot = Effect.fnUntraced(function* (fleet: typeof Fleet.Service) {
	const reconciled = vi.spyOn(fleet, "reconcile");
	yield* Effect.addFinalizer(() => Effect.sync(() => reconciled.mockRestore()));
	yield* cycle.pipe(Effect.provideService(Fleet, fleet));
	return reconciled.mock.calls.map(([id]) => id);
});

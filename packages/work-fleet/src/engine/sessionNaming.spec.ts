import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { FleetRepository, fleetSessionJournal } from "#engine/repository.ts";
import { SessionJournal } from "#session/service.ts";
import { namedAttempt, namedRecord } from "#test/namedCloudHost.ts";
import { sessionNaming } from "#test/sessionNaming.ts";

for (const count of [1, 1000]) {
	it.effect(`loads only the acknowledged work when naming a launch among ${count} records`, function* () {
		const fixture = sessionNaming(count);
		yield* Effect.gen(function* () {
			const journal = yield* SessionJournal;
			yield* journal.acknowledgeSession("synthetic-worker", "synthetic-session");
			const before = fixture.lists();
			expect(yield* journal.sessionName?.("synthetic-worker") ?? Effect.die("Missing naming method")).toBe("synthetic-0: Readable title");
			expect(fixture.lists()).toBe(before);
			expect(fixture.loads).toEqual(["synthetic-0"]);
		}).pipe(Effect.provide(fleetSessionJournal.pipe(Layer.provide(Layer.succeed(FleetRepository)(fixture.store)))));
	});
}

for (const state of ["missing", "ambiguous", "changed"] as const) {
	it.effect(`rejects a ${state} launch intent without scanning other records`, function* () {
		const fixture = sessionNaming(10);
		yield* Effect.gen(function* () {
			const journal = yield* SessionJournal;
			yield* journal.acknowledgeSession("synthetic-worker", "synthetic-session");
			if (state === "missing") {
				fixture.remove();
			} else {
				fixture.replace(namedRecord("synthetic-0", state === "ambiguous" ? [namedAttempt("worker"), namedAttempt("worker")] : []));
			}
			const before = fixture.lists();
			const failure = yield* (journal.sessionName?.("synthetic-worker") ?? Effect.die("Missing naming method")).pipe(Effect.flip);
			expect(failure).toMatchObject({ reason: "persistence" });
			expect(fixture.lists()).toBe(before);
		}).pipe(Effect.provide(fleetSessionJournal.pipe(Layer.provide(Layer.succeed(FleetRepository)(fixture.store)))));
	});
}

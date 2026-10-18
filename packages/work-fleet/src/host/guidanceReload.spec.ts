import { utimesSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Clock, Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { dispatchApproved } from "#host/admission.ts";
import { hostLayer } from "#host/commands.ts";
import { unchanged } from "#host/mainSource.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { MAIN } from "#test/mainSource.ts";
import { postgresTests } from "#test/postgres.ts";

const launch = Effect.fn("Guidance.launch")(function* (fixture: HostFixture, role: "worker" | "reviewer", id: string) {
	const dispatched = yield* dispatchApproved(fixture.host, id);
	if (role === "worker") {
		return dispatched;
	}
	for (const [key, observation] of fixture.provider.observations) {
		fixture.provider.observations.set(key, { ...observation, execution: "completed" });
	}
	return yield* (yield* Fleet).reconcile(id);
});

for (const role of ["worker", "reviewer"] as const) {
	postgresTests("live")(`reloads edited ${role} guidance between launches in the same host`, () =>
		withHost(
			{ "guidance.txt": "Original synthetic guidance.", "one.md": task("one", "approved"), "two.md": task("two", "approved") },
			{ worker: { branchPrefix: "test/", sharedEnvironment: "/synthetic/env.sh", [`${role}Guidance`]: { file: "guidance.txt" } } },
			(fixture) => {
				const integrations = engineIntegrations(
					{ mainQuery: (preparation) => Effect.succeed(unchanged(preparation.baseRevision, MAIN)), noChange: true },
					[],
				);
				return Effect.gen(function* () {
					const first = yield* launch(fixture, role, "one");
					expect(first.value.attempts.find((attempt) => attempt.role === role)?.prompt).toContain("Original synthetic guidance.");
					fixture.write("guidance.txt", "Updated synthetic guidance.");
					const changedAt = new Date((yield* Clock.currentTimeMillis) + 1000);
					utimesSync(join(fixture.host.boardDir, "guidance.txt"), changedAt, changedAt);
					const second = yield* launch(fixture, role, "two");
					const prompt = second.value.attempts.find((attempt) => attempt.role === role)?.prompt;
					expect(prompt).toContain("Updated synthetic guidance.");
					expect(prompt).not.toContain("Original synthetic guidance.");
				}).pipe(Effect.provide(hostLayer(fixture.host, { ...fixture.parts, integrations })));
			},
		),
	);
}

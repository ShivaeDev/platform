import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { dispatchApproved } from "#host/admission.ts";
import { hostLayer } from "#host/commands.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";

postgresTests("live")("explicit dispatch approves an edited brief while its existing worker runs", () =>
	withHost({ "one.md": task("one", "approved", "Original criteria.") }, {}, (fixture) =>
		Effect.gen(function* () {
			const worker = yield* dispatchApproved(fixture.host, "one");
			const current = task("one", "approved", "Edited criteria.");
			fixture.write("one.md", current);
			const approved = yield* dispatchApproved(fixture.host, "one");
			expect(approved.value.boardContext).toBe(current);
			expect(approved.value.boardRevision).not.toBe(worker.value.boardRevision);
			expect(approved.value.prompt).toBe(current);
			expect(approved.value.attempts.map(({ briefSteers: _steers, ...attempt }) => attempt)).toEqual(worker.value.attempts);
			expect(approved.value.attempts[0]?.briefSteers).toHaveLength(1);
			expect(approved.value.history ?? []).toEqual([]);
			expect(approved.value.stage).toBe("executing");
			expect((yield* (yield* Fleet).reconcile("one")).value.stage).toBe("executing");
			expect(fixture.provider.launched).toHaveLength(1);
		}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts))),
	),
);

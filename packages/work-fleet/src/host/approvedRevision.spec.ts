import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { admitApproved } from "#host/admission.ts";
import { hostLayer } from "#host/commands.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";

postgresTests("live")("an approved brief edit during preparation launches the current brief on the next pass", function* () {
	yield* withHost({ "one.md": task("one", "approved", "Reviewed source.") }, {}, (fixture) =>
		Effect.gen(function* () {
			yield* admitApproved(fixture.host);
			const fleet = yield* Fleet;
			const first = (yield* fleet.get("one")).value;
			fixture.write("one.md", task("one", "approved", "Edited source."));
			yield* admitApproved(fixture.host);
			const result = yield* fleet.dispatch("one");
			expect(result.value.boardRevision).not.toBe(first.boardRevision);
			expect(result.value.stage).toBe("executing");
			expect(result.value.boardContext).toContain("Edited source.");
			expect(result.value.prompt).toContain("Edited source.");
			expect(fixture.provider.launched).toHaveLength(1);
		}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts))),
	);
});

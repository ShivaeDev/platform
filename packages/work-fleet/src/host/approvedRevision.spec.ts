import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { admitApproved } from "#host/admission.ts";
import { hostLayer } from "#host/commands.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

it.live.skipIf(storageDatabaseUrl === undefined)(
	"an authored brief edit during preparation requires a Board context decision on the next pass",
	function* () {
		yield* withHost({ "one.md": task("one", "approved", "Reviewed source.") }, {}, (fixture) =>
			Effect.gen(function* () {
				yield* admitApproved(fixture.host);
				const fleet = yield* Fleet;
				const first = (yield* fleet.get("one")).value;
				fixture.write("one.md", task("one", "approved", "Edited source."));
				yield* admitApproved(fixture.host);
				const result = yield* fleet.dispatch("one");
				expect(result.value.boardRevision).toBe(first.boardRevision);
				expect(result.value.stage).toBe("needs-human");
				expect(result.value.decision?.reason).toBe("Board context changed");
				expect(result.value.boardContext).toEqual(first.boardContext);
				expect(result.value.prompt).toEqual(first.prompt);
				expect(fixture.provider.launched).toHaveLength(0);
			}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts))),
		);
	},
);

import { expect } from "vitest";
import { legacyRecords } from "#test/hostDatabaseTraits.ts";
import { approvedWork, host } from "#test/hostStory.ts";
import { MAIN } from "#test/mainSource.ts";
import { migrationRecords } from "#test/migrationRecords.ts";
import { prepared } from "#test/preparation.ts";

host.it(
	"daemon startup migrates populated JSONB records and continues serving reads and writes",
	[approvedWork(["three"]), legacyRecords],
	function* (daemon) {
		for (const value of migrationRecords()) {
			expect(yield* daemon.get(value.workId)).toEqual(value);
		}
		const created = yield* daemon.prepare({
			cwd: "/synthetic-repository",
			preparation: prepared({ baseRevision: MAIN.revision, observedAt: MAIN.observedAt }),
			prompt: "New work after migration",
			workId: "three",
		});
		expect(created.step).toBe("queued");
		const dispatched = yield* daemon.fleetDispatch("three");
		expect(dispatched.value.decision?.reason).toBeUndefined();
		expect(dispatched.value.step).toBe("working");
		expect((yield* daemon.get("three")).attempts).toEqual(dispatched.value.attempts);
	},
);

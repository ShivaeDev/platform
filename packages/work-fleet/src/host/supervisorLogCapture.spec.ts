import { expect } from "vitest";
import { fleetSupervisor } from "#test/supervisorStory.ts";

fleetSupervisor.it(
	"startup rotates an oversized log and keeps child output and shutdown messages in the active log",
	[],
	function* (fleet) {
		const previous = "previous supervisor output\n".repeat(250_000);
		yield* fleet.seedLog(previous);

		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		yield* fleet.down();
		yield* fleet.exit();

		expect(fleet.logBackup(1)).toBe(previous);
		expect(fleet.log()).toEqual(
			expect.stringMatching(
				/(?=.*supervisor: started daemon)(?=.*supervisor: started board)(?=.*board: )(?=.*daemon: )(?=.*supervisor: stopped Fleet and Board)/su,
			),
		);
	},
	60_000,
);

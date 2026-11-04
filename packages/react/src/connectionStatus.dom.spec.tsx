import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { connections, watching } from "#test/connection/story.tsx";

for (const source of ["online", "visibilitychange"] as const) {
	connections.it(
		`a socket drop retains both bindings' data without a refusal and ${source} reconnects before the next retry`,
		[watching],
		function* ({ activityStatus, dropSocket, outagePasses, restoreSocket, renameNote, resume, settleStatus, shown }) {
			expect(yield* shown()).toEqual({ connection: "live", data: ["One", "Summary"], refusal: "" });

			yield* dropSocket();
			yield* outagePasses();

			yield* outcomes([
				["screen during the outage", () => shown(), { connection: "reconnecting", data: ["One", "Summary"], refusal: "" }],
				["client activity", () => activityStatus(), "reconnecting"],
			]);

			yield* renameNote();
			yield* restoreSocket();
			yield* resume(source);
			yield* settleStatus();

			yield* outcomes([
				["recovered screen", () => shown(), { connection: "live", data: ["Changed while away", "Summary"], refusal: "" }],
				["client activity", () => activityStatus(), "live"],
			]);
		},
	);
}

connections.it(
	"a real read refusal reaches the screen separately from connection status",
	[watching],
	function* ({ refuseNote, refreshNote, shown }) {
		expect(yield* shown()).toEqual({ connection: "live", data: ["One", "Summary"], refusal: "" });

		yield* refuseNote();
		yield* refreshNote();

		expect(yield* shown()).toEqual({ connection: "live", data: ["One", "Summary"], refusal: "Private note" });
	},
);

connections.it(
	"a brief socket drop keeps the shared status live through recovery",
	[watching],
	function* ({ dropSocket, restoreSocket, resume, settleStatus, shown }) {
		yield* dropSocket();

		expect(yield* shown()).toEqual({ connection: "live", data: ["One", "Summary"], refusal: "" });

		yield* restoreSocket();
		yield* resume("online");
		yield* settleStatus();

		expect(yield* shown()).toEqual({ connection: "live", data: ["One", "Summary"], refusal: "" });
	},
);

connections.it(
	"the client status still follows another binding after its primary query unmounts",
	[watching],
	function* ({ closeNote, dropSocket, outagePasses, shown }) {
		yield* closeNote();
		expect(yield* shown()).toEqual({ connection: "live", data: ["Summary"], refusal: "" });

		yield* dropSocket();
		yield* outagePasses();

		expect(yield* shown()).toEqual({ connection: "reconnecting", data: ["Summary"], refusal: "" });
	},
);

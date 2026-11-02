import { expect } from "vitest";
import { dispatchers } from "#test/dispatchers.ts";

dispatchers.it(
	"routes a selected hostname through both of Node's dispatcher slots and leaves the others alone",
	[],
	function* ({ opensRouting, sends, sent }) {
		yield* opensRouting();
		yield* sends("https://github.com");
		yield* sends("https://example.com");

		expect(yield* sent()).toEqual([
			"slot 1 sent http://127.0.0.1:4321",
			"slot 1 sent https://example.com",
			"slot 2 sent http://127.0.0.1:4321",
			"slot 2 sent https://example.com",
		]);
	},
);

for (const ending of ["succeeds", "fails"] as const) {
	dispatchers.it(
		`restores both of Node's dispatcher slots when the routing scope ${ending}`,
		[],
		function* ({ lastSent, opensRouting, endsRouting, sends }) {
			yield* opensRouting();
			yield* sends("https://github.com");
			expect(yield* lastSent()).toEqual(["slot 1 sent http://127.0.0.1:4321", "slot 2 sent http://127.0.0.1:4321"]);

			yield* endsRouting(ending);

			yield* sends("https://github.com");

			expect(yield* lastSent()).toEqual(["slot 1 sent https://github.com", "slot 2 sent https://github.com"]);
		},
	);
}

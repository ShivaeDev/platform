import { expect } from "vitest";
import { dispatchers } from "#test/outbound.ts";

dispatchers.it(
	"routes a selected hostname through both of Node's dispatcher slots and leaves the others alone",
	[],
	function* ({ routesGitHubWhileScoped, sent }) {
		yield* routesGitHubWhileScoped("succeeds");

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
		function* ({ lastSent, routesGitHubWhileScoped, sends }) {
			yield* routesGitHubWhileScoped(ending);

			yield* sends("https://github.com");

			expect(yield* lastSent()).toEqual(["slot 1 sent https://github.com", "slot 2 sent https://github.com"]);
		},
	);
}

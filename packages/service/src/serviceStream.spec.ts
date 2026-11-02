import { expect } from "@effect/vitest";
import { serviceBuilt, serviceStory } from "#test/serviceStory.ts";

serviceStory.it(
	"a returned Stream uses the caller's greeting while its outer Effect uses the Layer's bound greeting",
	[serviceBuilt({ greeting: "from the Layer" })],
	function* ({ requestGreetingStream, collectGreetings }) {
		yield* requestGreetingStream();

		expect(yield* collectGreetings("from the caller")).toEqual(["from the Layer: from the caller"]);
	},
);

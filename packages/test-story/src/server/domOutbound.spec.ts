import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { storyRunner } from "#test/storyRunner.ts";

const DOM = { environment: fileURLToPath(new URL("./domEnvironment.config.ts", import.meta.url)) };

for (const [name, host] of [
	["refuses host fetch even when the host catches it", "unrouted-host.test"],
	["refuses document fetch even when the document catches it", "unrouted-document.test"],
	["refuses an unrouted redirect destination", "unrouted-redirect.test"],
] as const) {
	storyRunner.it(`fails the DOM story that ${name}`, [], function* ({ message, runStory }) {
		yield* runStory("unroutedDomStories", `Contained DOM Story: ${name}`, DOM);

		expect(yield* message()).toBe(
			[
				`test-story refused an outbound request to ${host}`,
				"help: Add this hostname to the story kit's outbound map and point it at a fake server. Only loopback requests may run",
				"      without a route.",
			].join("\n"),
		);
	});
}

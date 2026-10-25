import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { storyRunner } from "#test/storyRunner.ts";

storyRunner.it("fails each DOM story with its unrouted host even when application code catches the fetch error", [], function* ({ run }) {
	const result = yield* run({
		environment: fileURLToPath(new URL("./domEnvironment.config.ts", import.meta.url)),
		include: "src/test-support/unroutedDomStories.ts",
	});
	expect(result.moduleErrors).toEqual([]);
	expect(result.stories).toMatchObject([
		{
			errors: [expect.stringContaining("test-story refused an outbound request to unrouted-host.test")],
			name: "Contained DOM Story: refuses host fetch even when the host catches it",
			state: "failed",
		},
		{
			errors: [expect.stringContaining("test-story refused an outbound request to unrouted-document.test")],
			name: "Contained DOM Story: refuses document fetch even when the document catches it",
			state: "failed",
		},
		{
			errors: [expect.stringContaining("test-story refused an outbound request to unrouted-redirect.test")],
			name: "Contained DOM Story: refuses an unrouted redirect destination",
			state: "failed",
		},
	]);
});

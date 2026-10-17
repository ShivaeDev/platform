import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { runStories } from "#test/runStories.ts";

it("fails each DOM story with its unrouted host even when application code catches the fetch error", async () => {
	const result = await runStories({
		environment: fileURLToPath(new URL("./domEnvironment.config.ts", import.meta.url)),
		include: "src/test-support/unroutedDomStories.ts",
	});
	expect(result.moduleErrors).toEqual([]);
	expect(result.stories).toHaveLength(3);
	for (const [index, hostname] of ["unrouted-host.test", "unrouted-document.test", "unrouted-redirect.test"].entries()) {
		expect(result.stories[index]?.state).toBe("failed");
		expect(result.stories[index]?.errors.join("\n")).toContain(`test-story refused an outbound request to ${hostname}`);
	}
});

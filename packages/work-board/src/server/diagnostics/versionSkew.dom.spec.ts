import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, readerAt } from "#test/boardStory.ts";
import { codexResponse, health } from "#test/diagnostics.ts";
import { fleetDiagnostics } from "#test/storyTraits.ts";

const unknownGithubLimits = fleetDiagnostics((observedAt) => ({
	codex: { observedAt, state: "ready", value: codexResponse.rateLimits },
	fleet: { observedAt, state: "ready", value: { ...health, observedAt } },
	github: { observedAt, state: "ready", value: { windows: [] } },
}));

boardStory.it(
	"shows a GitHub decode observation while Codex usage and Fleet health survive through Board RPC and System",
	[unknownGithubLimits, readerAt("/_board/system")],
	function* ({ client, page }) {
		const data = yield* Effect.promise(() => client.run(client.api.diagnostics.run(undefined)));
		expect(data.sources.github).toMatchObject({ cause: expect.stringContaining("GitHub diagnostics decode failed"), state: "error" });
		const github = page.document.querySelector('[data-source="github"]');
		expect(github?.getAttribute("data-state")).toBe("error");
		expect(github?.textContent).toContain("GitHub diagnostics decode failed");
		expect(github?.textContent).toContain("Expected");
		expect(page.document.querySelector('[data-source="codex"]')?.textContent).toContain("24% used");
		expect(page.document.querySelector('[data-source="fleet"]')?.textContent).toContain("3 / 8");
	},
);

boardStory.it(
	"reports decode observations for every source when the daemon snapshot itself has an unknown shape",
	[fleetDiagnostics(() => null), readerAt("/_board/system")],
	function* ({ client, page }) {
		const data = yield* Effect.promise(() => client.run(client.api.diagnostics.run(undefined)));
		for (const source of ["codex", "github", "fleet"] as const) {
			expect(data.sources[source]).toMatchObject({ cause: expect.stringContaining("diagnostics decode failed"), state: "error" });
			expect(page.document.querySelector(`[data-source="${source}"]`)?.getAttribute("data-state")).toBe("error");
		}
	},
);

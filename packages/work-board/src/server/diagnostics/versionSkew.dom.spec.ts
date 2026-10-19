import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { codexResponse, health } from "#test/diagnostics.ts";
import { screenStory } from "#test/screenStory.ts";
import { screenRoute } from "#test/screenWorkspaceTraits.ts";
import { sessionScreen } from "#test/sessionScreen.ts";
import { sessionDiagnostics } from "#test/sessionTransport.ts";

expectNoReactWarnings();

const unknownGithubLimits = sessionDiagnostics((observedAt) => ({
	codex: { observedAt, state: "ready", value: codexResponse.rateLimits },
	fleet: { observedAt, state: "ready", value: { ...health, observedAt } },
	github: { observedAt, state: "ready", value: { windows: [] } },
}));

screenStory.it(
	"shows a GitHub decode observation while Codex usage and Fleet health survive through Board RPC and System",
	[unknownGithubLimits, screenRoute("/_board/system"), sessionScreen("response")],
	function* ({ readSessionDiagnostics, findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('[data-source="github"]')).not.toBeNull()));
		const data = yield* Effect.promise(() => readSessionDiagnostics());
		expect(data.sources.github).toMatchObject({ cause: expect.stringContaining("GitHub diagnostics decode failed"), state: "error" });
		const github = findElement('[data-source="github"]');
		expect(github?.getAttribute("data-state")).toBe("error");
		expect(readText('[data-source="github"]')).toContain("GitHub diagnostics decode failed");
		expect(readText('[data-source="github"]')).toContain("Expected");
		expect(readText('[data-source="codex"]')).toContain("24% used");
		expect(readText('[data-source="fleet"]')).toContain("3 / 8");
	},
);

screenStory.it(
	"reports decode observations for every source when the daemon snapshot itself has an unknown shape",
	[sessionDiagnostics(() => null), screenRoute("/_board/system"), sessionScreen("response")],
	function* ({ readSessionDiagnostics, findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement('[data-source="github"]')).not.toBeNull()));
		const data = yield* Effect.promise(() => readSessionDiagnostics());
		for (const source of ["codex", "github", "fleet"] as const) {
			expect(data.sources[source]).toMatchObject({ cause: expect.stringContaining("diagnostics decode failed"), state: "error" });
			expect(findElement(`[data-source="${source}"]`)?.getAttribute("data-state")).toBe("error");
			expect(readText(`[data-source="${source}"]`)).toContain("decode failed");
		}
	},
);

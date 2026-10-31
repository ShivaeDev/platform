import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory } from "#test/boardStory.ts";
import { codexProtocolStory } from "#test/codexProtocolStory.ts";
import { codexProvider } from "#test/readingTraits.ts";

boardStory.it("a ready Codex account shows how much of each usage window is used", [codexProvider("ready")], function* ({ systemCardLimits }) {
	expect(yield* systemCardLimits("codex")).toEqual({ "5-hour limit": "24% used", "Weekly limit": "63% used" });
});

for (const mode of ["missing", "api-key"]) {
	boardStory.it(`a ${mode} Codex account shows Codex as not configured`, [codexProvider(mode)], function* ({ systemCards }) {
		expect(yield* systemCards()).toMatchObject({ codex: "not-configured" });
	});
}

boardStory.it("an API-key Codex account says usage windows are not available for it", [codexProvider("api-key")], function* ({ systemCardText }) {
	expect(yield* systemCardText("codex")).toContain("Codex usage windows are not available for API-key accounts");
});

for (const [mode, message] of [
	["initialize-error", "Initialize refused"],
	["refusal", "Account forbidden"],
	["exit", "exited"],
	["malformed", "invalid"],
] as const) {
	boardStory.it(
		`a Codex provider ${mode} shows the Codex card as failed with "${message}"`,
		[codexProvider(mode)],
		function* ({ systemCards, systemCardText }) {
			yield* outcomes([
				["codex card", () => systemCards(), expect.objectContaining({ codex: "error" })],
				["codex message", () => systemCardText("codex"), expect.stringContaining(message)],
			]);
		},
	);
}

boardStory.it(
	"a Codex provider that never answers times out after its 50 millisecond limit",
	[codexProvider("timeout", 50)],
	function* ({ systemCardText }) {
		expect(yield* systemCardText("codex")).toContain("Codex rate limits timed out");
	},
);

codexProtocolStory.it(
	"a host cancelling a stalled Codex read kills the provider process",
	[],
	function* ({ hostCancelsAtDeadline, providerProcess }) {
		expect(yield* providerProcess()).toBe("running");

		yield* hostCancelsAtDeadline();

		expect(yield* providerProcess()).toBe("killed");
	},
);

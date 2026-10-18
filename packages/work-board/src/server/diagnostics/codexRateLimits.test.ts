import { expect } from "vitest";
import { boardStory } from "#test/boardStory.ts";
import { codexProtocolStory } from "#test/codexProtocolStory.ts";
import { codexProvider } from "#test/readingTraits.ts";

boardStory.it(
	"initializes the provider, reads its account and limits, and denies approval requests",
	[codexProvider("ready")],
	function* ({ systemHtml }) {
		const html = yield* systemHtml();
		expect(html).toContain("24% used");
		expect(html).toContain("63% used");
	},
);
for (const mode of ["missing", "api-key"]) {
	boardStory.it(`${mode} accounts have no Codex usage windows`, [codexProvider(mode)], function* ({ systemHtml }) {
		const html = yield* systemHtml();
		expect(html).toContain('data-source="codex" data-state="not-configured"');
		if (mode === "api-key") {
			expect(html).toContain("Codex usage windows are not available for API-key accounts");
		}
	});
}
for (const [mode, message] of [
	["initialize-error", "Initialize refused"],
	["refusal", "Account forbidden"],
	["exit", "exited"],
	["malformed", "invalid"],
] as const) {
	boardStory.it(`reports the provider's ${mode} failure`, [codexProvider(mode)], function* ({ systemHtml }) {
		const html = yield* systemHtml();
		expect(html).toContain('data-source="codex" data-state="error"');
		expect(html).toContain(message);
	});
}
boardStory.it("bounds a stalled provider read", [codexProvider("timeout", 50)], function* ({ systemHtml }) {
	expect(yield* systemHtml()).toContain("Codex rate limits timed out");
});
codexProtocolStory.it("interruption terminates the provider child", [], function* ({ cancelRead, childKilled }) {
	expect((yield* cancelRead())._tag).toBe("Failure");
	expect(childKilled()).toBe(true);
});

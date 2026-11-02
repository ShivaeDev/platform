import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { concurrentProviders, overlappingProviders, scopedOutbound, separateProviders } from "#test/scopedOutbound.ts";

scopedOutbound.it("reaches two providers registered in separate scopes", [separateProviders], function* ({ replyFrom }) {
	yield* outcomes([
		["first provider", () => replyFrom("first.test"), "first"],
		["second provider", () => replyFrom("second.test"), "second"],
	]);
});

scopedOutbound.it("reaches both providers when their scopes register concurrently", [concurrentProviders], function* ({ replyFrom }) {
	yield* outcomes([
		["first provider", () => replyFrom("first.test"), "first"],
		["second provider", () => replyFrom("second.test"), "second"],
	]);
});

for (const [closed, remaining] of [
	["first", "second"],
	["second", "first"],
] as const) {
	scopedOutbound.it(
		`keeps the ${remaining} provider reachable after the ${closed} scope closes`,
		[separateProviders],
		function* ({ closes, replyFrom }) {
			expect(yield* replyFrom(`${remaining}.test`)).toBe(remaining);

			yield* closes(closed);

			expect(yield* replyFrom(`${remaining}.test`)).toBe(remaining);
		},
	);
}

for (const [closed, remaining] of [
	["second", "first"],
	["first", "second"],
] as const) {
	scopedOutbound.it(
		`routes a shared host to the newest provider, then to the ${remaining} provider after the ${closed} scope closes`,
		[overlappingProviders],
		function* ({ closes, replyFrom }) {
			expect(yield* replyFrom("shared.test")).toBe("second");

			yield* closes(closed);

			expect(yield* replyFrom("shared.test")).toBe(remaining);
		},
	);
}

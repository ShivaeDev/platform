import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { queryWindowPageShown, queryWindows } from "#test/queryWindowScreen.tsx";

queryWindows.it(
	"each query hands its own coalesce window to its live binding, and a query without one sets none",
	[queryWindowPageShown()],
	function* ({ windows }) {
		expect(yield* windows()).toEqual({ dashboard: "2 seconds", detail: "100 millis", inherited: undefined });
	},
);

queryWindows.it(
	"changing a query's window hands the new window over without a new subscription or read",
	[queryWindowPageShown()],
	function* ({ reads, slowDetail, subscriptions, windows }) {
		expect((yield* windows()).detail).toBe("100 millis");

		yield* slowDetail();

		yield* outcomes({
			reads: [reads(), { dashboard: 1, detail: 1, inherited: 1 }],
			subscriptions: [subscriptions(), 3],
			window: [windows(), { dashboard: "2 seconds", detail: "300 millis", inherited: undefined }],
		});
	},
);

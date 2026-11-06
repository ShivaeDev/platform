import { expect } from "vitest";
import { outcomes } from "#server/outcomes.ts";
import { readPage } from "#test/readPage.ts";

readPage.it("the page's answered subscription settles the wait", [], function* ({ waitForSubscriptions, readout }) {
	yield* waitForSubscriptions;

	expect(yield* readout.subscriptions).toEqual([
		{ payload: { queries: [{ payload: { id: 1 }, query: "get" }] }, state: "answered", tag: "page.$changes" },
	]);
});

for (const ending of ["empty", "defect"] as const) {
	readPage.it(
		`a subscription ending with ${ending} closes its opening and settles every wait`,
		[],
		function* ({ openSecondPage, startWaiting, endSecondPage, readout }) {
			yield* openSecondPage();
			const first = yield* startWaiting();
			const second = yield* startWaiting();
			yield* outcomes([
				["first wait", () => first.state, "waiting"],
				["second wait", () => second.state, "waiting"],
				["subscription openings", () => readout.subscriptionStates, ["answered", "open"]],
			]);

			yield* endSecondPage(ending);
			yield* first.finish;
			yield* second.finish;

			yield* outcomes([
				["subscription openings", () => readout.subscriptionStates, ["answered", "closed"]],
				["received hints", () => readout.hints, [{ _tag: "Result", query: "get", queryIndex: 0, value: "First page" }]],
			]);
		},
	);
}

readPage.it(
	"a disconnected stream closes its pending subscription and settles every wait",
	[],
	function* ({ openSecondPage, startWaiting, disconnect, readout }) {
		yield* openSecondPage();
		const first = yield* startWaiting();
		const second = yield* startWaiting();
		yield* outcomes([
			["first wait", () => first.state, "waiting"],
			["second wait", () => second.state, "waiting"],
			["subscription openings", () => readout.subscriptionStates, ["answered", "open"]],
		]);

		yield* disconnect();
		yield* first.finish;
		yield* second.finish;

		expect(yield* readout.subscriptionStates).toEqual(["answered", "closed"]);
	},
);

readPage.it(
	"a refused subscription reports its refusal tag and settles the wait without a hint",
	[],
	function* ({ openPrivatePage, waitForSubscriptions, readout }) {
		yield* openPrivatePage();
		yield* waitForSubscriptions;

		yield* outcomes([
			["received hints", () => readout.hints, [{ _tag: "Result", query: "get", queryIndex: 0, value: "First page" }]],
			[
				"subscription openings",
				() => readout.subscriptions,
				[
					{ payload: { queries: [{ payload: { id: 1 }, query: "get" }] }, state: "answered", tag: "page.$changes" },
					{ payload: { queries: [{ payload: { id: 3 }, query: "get" }] }, refusalTag: "QueryReadDenied", state: "refused", tag: "page.$changes" },
				],
			],
		]);
	},
);

readPage.it(
	"each wait stays open until the remaining subscription answers and the page shows its first result",
	[],
	function* ({ openSecondPage, startWaiting, releaseSecondPage, waitForPage, readout }) {
		yield* openSecondPage();
		const waiting = yield* startWaiting();
		const another = yield* startWaiting();
		yield* outcomes([
			["first wait", () => waiting.state, "waiting"],
			["second wait", () => another.state, "waiting"],
			["subscription openings", () => readout.subscriptionStates, ["answered", "open"]],
		]);

		yield* releaseSecondPage();
		yield* waiting.finish;
		yield* another.finish;
		yield* waitForPage();

		yield* outcomes([
			["first wait", () => waiting.state, "settled"],
			["second wait", () => another.state, "settled"],
			["shown live result", () => readout.secondPage, "Second page"],
			["subscription openings", () => readout.subscriptionStates, ["answered", "answered"]],
		]);
	},
);

readPage.it(
	"signing in on the page opens a second socket counted by the same readout",
	[],
	function* ({ signIn, socketUrl, waitForSubscriptions, readout }) {
		const before = yield* readout.readCount;
		expect(yield* readout.sockets).toEqual([socketUrl()]);

		yield* signIn();
		yield* waitForSubscriptions;

		yield* outcomes([
			["counted reads", () => readout.readCount, before + 1],
			["opened sockets", () => readout.sockets, [socketUrl(), socketUrl()]],
			["subscription openings", () => readout.subscriptionStates, ["answered", "answered"]],
		]);
	},
);

readPage.it(
	"signing out on the page opens another socket counted by the same readout",
	[],
	function* ({ signIn, signOut, socketUrl, waitForSubscriptions, readout }) {
		yield* signIn();
		yield* waitForSubscriptions;
		const before = yield* readout.readCount;

		yield* signOut();
		yield* waitForSubscriptions;

		yield* outcomes([
			["counted reads", () => readout.readCount, before + 1],
			["opened sockets", () => readout.sockets, [socketUrl(), socketUrl(), socketUrl()]],
		]);
	},
);

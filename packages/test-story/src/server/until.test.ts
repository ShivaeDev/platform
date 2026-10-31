import { expect } from "vitest";
import { signals, source } from "#test/signals.ts";

signals.it("subscribes before reading, settles on the first match and releases its subscription", [], function* ({ wait, result, seen, lifetime }) {
	yield* wait();

	expect(result()).toEqual({ status: "ready" });
	expect(seen()).toEqual(["subscribed: waiting", "subscribed: ready"]);
	expect(lifetime()).toEqual(["subscribed", "unsubscribed"]);
});

signals.it("collects signals through the first matching collection", [], function* ({ wait, result }) {
	yield* wait(true);

	expect(result()).toEqual([{ status: "waiting" }, { status: "ready" }]);
});

for (const collect of [false, true]) {
	signals.it(
		`times out ${collect ? "collectUntil" : "until"} on live time while the source keeps its TestClock`,
		[source("clock")],
		function* ({ wait, ending, time }) {
			expect(yield* time()).toBe(0);

			yield* wait(collect);

			expect(yield* time()).toBe(0);
			expect(ending()).toBe(
				`failed with SignalNotReceived: Signal "ready" never arrived: the live-time deadline expired.\nLast value seen: ${collect ? '[{"status":"waiting"}]' : '{"status":"waiting"}'}\nhelp: Check that the action emits this signal and that the predicate matches its expected value.`,
			);
		},
	);
}

signals.it("releases a quiet subscription when its deadline expires", [source("quiet")], function* ({ wait, lifetime }) {
	yield* wait();

	expect(lifetime()).toEqual(["subscribed", "unsubscribed"]);
});

signals.it("names the missing signal when its stream ends without any value", [source("empty")], function* ({ wait, ending }) {
	yield* wait();

	expect(ending()).toContain('Signal "ready" never arrived: the stream ended.\nLast value seen: (no values received)\nhelp:');
});

signals.it("preserves a source failure", [source("failed")], function* ({ wait, ending }) {
	yield* wait();

	expect(ending()).toBe("failed with source failed");
});

for (const collect of [false, true]) {
	signals.it(
		`names a signal that emits nothing before ${collect ? "collectUntil" : "until"} times out`,
		[source("silent")],
		function* ({ wait, ending }) {
			yield* wait(collect);

			expect(ending()).toContain('Signal "ready" never arrived: the live-time deadline expired.\nLast value seen: (no values received)\nhelp:');
		},
	);
}

signals.it(
	"uses a live deadline in a live-clock story too",
	[source("quiet")],
	function* ({ wait, ending }) {
		yield* wait();

		expect(ending()).toContain('Signal "ready" never arrived: the live-time deadline expired.');
	},
	{ clock: "live" },
);

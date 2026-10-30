import { expect } from "@effect/vitest";
import { Clock } from "effect";
import { host } from "#test/hostStory.ts";

const retryDelays = [2000, 4000, 8000, 16_000];

host.it("a ten-second liveness stall stays quiet and probes never overlap", [], function* (daemon) {
	const proxy = yield* daemon.livenessProxy();
	yield* daemon.watchEvents({ events: "done", port: proxy.port });
	yield* proxy.probed;
	yield* daemon.elapse("10 seconds");
	expect(daemon.eventLines()).toEqual([]);
	proxy.resume();
	yield* proxy.answered;
	yield* daemon.elapse("600 millis");
	expect(daemon.eventLines()).toEqual([]);
	expect(proxy.probes().overlaps).toEqual([]);
	expect(proxy.probes().started.length).toBeGreaterThanOrEqual(4);
});

host.it(
	"a silent daemon reports one outage after five sequential probes with exponential backoff",
	[],
	function* (daemon) {
		const proxy = yield* daemon.livenessProxy();
		yield* daemon.watchEvents({ events: "done", port: proxy.port, timeout: 70 });
		yield* proxy.probed;
		const began = yield* Clock.currentTimeMillis;
		yield* daemon.elapse("29 seconds");
		expect(daemon.eventLines()).toEqual([]);
		yield* daemon.awaitEvent("daemon-unreachable", 15_000);
		const { overlaps, started } = proxy.probes();
		expect(overlaps).toEqual([]);
		expect(started).toHaveLength(retryDelays.length + 1);
		expect((yield* Clock.currentTimeMillis) - began).toBeGreaterThanOrEqual(34_000);
		let previous = began;
		for (const [index, time] of started.entries()) {
			if (index > 0) {
				expect(time - previous).toBeGreaterThanOrEqual(1000 + (retryDelays[index - 1] ?? 0) - 100);
			}
			previous = time;
		}
		yield* daemon.elapse("5 seconds");
		expect(daemon.eventLines()).toEqual([{ kind: "daemon-unreachable" }]);
		proxy.resume();
		yield* daemon.awaitEvent("daemon-back");
		expect(daemon.eventLines()).toEqual([{ kind: "daemon-unreachable" }, { kind: "daemon-back" }]);
		expect(proxy.probes().overlaps).toEqual([]);
	},
	70_000,
);

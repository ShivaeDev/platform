import { expect } from "@effect/vitest";
import { HEAD, PR } from "#test/githubResult.ts";
import { host, storedWork } from "#test/hostStory.ts";

const tracked = storedWork("one", "waiting", { attentionOwner: "automation", result: { head: HEAD, kind: "change", paths: [], pr: PR } });

host.it("a recovered GitHub transport failure stays quiet", [tracked], function* (daemon) {
	const github = yield* daemon.prApi();
	yield* github.dropNextRequest();
	yield* daemon.watchDefault({ apiUrl: github.url, follow: true, json: true, prInterval: 0.1 });
	yield* github.awaitAbandonedRequest();

	github.pull({ state: "closed" });
	yield* daemon.awaitEvent("pr-closed");

	expect(daemon.eventLines()).toEqual([expect.objectContaining({ kind: "pr-closed", workId: "one" })]);
});

host.it(
	"a recovered GitHub timeout stays quiet",
	[tracked],
	function* (daemon) {
		const github = yield* daemon.prApi();
		const held = yield* github.holdNextRequest();
		yield* daemon.watchDefault({ apiUrl: github.url, follow: true, json: true, prInterval: 0.1, timeout: 45 });
		yield* held.waiting;
		yield* github.awaitAbandonedRequest("40 seconds");

		github.pull({ state: "closed" });
		yield* held.release;
		yield* daemon.awaitEvent("pr-closed");

		expect(daemon.eventLines()).toEqual([expect.objectContaining({ kind: "pr-closed", workId: "one" })]);
	},
	45_000,
);

host.it("a recovered GitHub retry-after response stays quiet", [tracked], function* (daemon) {
	const github = yield* daemon.prApi();
	github.fail(429, 7, { "retry-after": "1" });
	yield* daemon.watchDefault({ apiUrl: github.url, follow: true, json: true, prInterval: 0.1 });
	yield* github.awaitRequests("/repos/example/repository/pulls/7", 1);

	github.pull({ state: "closed" });
	yield* daemon.awaitEvent("pr-closed");

	expect(daemon.eventLines()).toEqual([expect.objectContaining({ kind: "pr-closed", workId: "one" })]);
});

host.it(
	"a daemon liveness outage shorter than a minute stays quiet after recovery",
	[],
	function* (daemon) {
		const proxy = yield* daemon.livenessProxy();
		yield* daemon.watchDefault({ follow: true, json: true, port: proxy.port, prEvents: false, timeout: 60 });
		yield* proxy.awaitProbes(6);

		proxy.resume();
		yield* proxy.answered;
		yield* proxy.awaitProbes(8);
		yield* daemon.stopWatch();

		expect(daemon.eventLines()).toEqual([]);
	},
	60_000,
);

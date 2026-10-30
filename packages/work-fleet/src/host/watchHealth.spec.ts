import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { HEAD, PR } from "#test/githubResult.ts";
import { delayedAnswer } from "#test/hostCommandDelaysTraits.ts";
import { approvedWork, host } from "#test/hostStory.ts";
import { humanDelivery } from "#test/humanDelivery.ts";

host.it(
	"stalled provider calls and watch delivery leave a responsive daemon quiet",
	[approvedWork(["one"]), delayedAnswer("startTurn")],
	function* (daemon) {
		daemon.enableDelay();
		yield* daemon.acknowledgeDispatch("one");
		yield* daemon.awaitDelay();
		const proxy = yield* daemon.stalledWatchProxy();
		yield* daemon.watchEvents({ events: "done", port: proxy.port });
		yield* proxy.subscribed.pipe(Effect.timeout("5 seconds"));
		yield* daemon.elapse("4 seconds");
		expect(daemon.eventLines()).toEqual([]);
		expect((yield* daemon.get("one")).attempts.at(-1)?.receipt).toBeUndefined();
		yield* daemon.releaseDelay();
		yield* daemon.launched("one");
	},
);

host.it(
	"a stopped daemon is reported after retries and its return clears the outage",
	[],
	function* (daemon) {
		yield* daemon.watchEvents({ events: "done", timeout: 60 });
		yield* daemon.awaitSnapshot();
		yield* daemon.stop();
		yield* daemon.awaitEvent("daemon-unreachable", 45_000);
		yield* daemon.start();
		yield* daemon.awaitEvent("daemon-back");
		expect(daemon.eventLines()).toEqual([{ kind: "daemon-unreachable" }, { kind: "daemon-back" }]);
	},
	60_000,
);

for (const samePort of [false, true]) {
	host.it(
		`watch reports daemon health across ${samePort ? "supervisor" : "new-port"} restart without replay`,
		[approvedWork(["one"]), humanDelivery],
		function* (daemon) {
			yield* daemon.watchEvents({ events: "waiting-on-orchestrator,released", timeout: 60 });
			yield* daemon.awaitSnapshot();
			const worker = yield* daemon.dispatch("one");
			daemon.finishReviewedWorker(worker);
			yield* daemon.reviewReady("one");
			yield* daemon.awaitEvent("waiting-on-orchestrator");
			const port = daemon.port();
			yield* daemon.stop();
			if (!samePort) {
				yield* daemon.awaitEvent("daemon-unreachable", 45_000);
			}
			yield* daemon.start(samePort ? port : 0);
			yield* daemon.awaitEvent("daemon-back");
			yield* daemon.request("daemon.answer", { release: true, workId: "one" });
			yield* daemon.awaitEvent("released");
			expect(daemon.eventLines()).toEqual([
				{
					head: HEAD,
					kind: "waiting-on-orchestrator",
					pr: PR,
					reason: "Reviewed PR is ready to merge",
					workId: "one",
				},
				{ kind: "daemon-unreachable" },
				{ kind: "daemon-back" },
				{ head: HEAD, kind: "released", pr: PR, workId: "one" },
			]);
		},
		60_000,
	);
}

host.it(
	"watch reports an initially unreachable daemon even with events filtered out",
	[],
	function* (daemon) {
		yield* daemon.stop();
		yield* daemon.watchEvents({ events: "done", timeout: 60 });
		yield* daemon.awaitEvent("daemon-unreachable", 45_000);
		yield* daemon.start();
		yield* daemon.awaitEvent("daemon-back");
		expect(daemon.eventLines()).toEqual([{ kind: "daemon-unreachable" }, { kind: "daemon-back" }]);
	},
	60_000,
);

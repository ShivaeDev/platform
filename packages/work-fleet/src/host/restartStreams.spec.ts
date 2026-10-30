import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { HEAD } from "#test/githubResult.ts";
import { delayedRefresh } from "#test/hostCommandDelaysTraits.ts";
import { boardWork, host } from "#test/hostStory.ts";

host.it(
	"dispatch resumes once after restart and watch and follow catch completion during disconnection",
	[boardWork({ "one.md": task("one", "approved").replace("fleet: approved", "fleet: approved\ndelivers: report") }), delayedRefresh()],
	function* (daemon) {
		const proxy = yield* daemon.streamProxy();
		const port = Number(new URL(proxy.url).port);
		yield* daemon.follow("follow", "watch", ["one"], { follow: true, port });
		yield* daemon.awaitSnapshot();
		const snapshots = daemon.snapshotCount();
		yield* daemon.watchEvents({ events: "done", port });
		yield* daemon.awaitSnapshotAfter(snapshots);
		yield* daemon.request("daemon.dispatch", { workId: "one" });
		yield* daemon.awaitDelay();
		const daemonPort = daemon.port();
		proxy.disconnect();

		yield* daemon.stop();
		daemon.removeDelay();
		yield* daemon.start(daemonPort);
		const worker = yield* daemon.launched("one");
		daemon.finishTurn(worker, `Recovered findings.\nFLEET_HEAD: ${HEAD}`);
		const completed = yield* daemon.reconcile("one");
		expect(completed.stage).toBe("done");
		proxy.resume();

		yield* daemon.awaitEvent("done");
		const summary = `one done: ${completed.report?.sourcePath}\n`;
		yield* daemon.awaitOutput("follow", summary);
		expect(daemon.eventLines().filter((event) => typeof event === "object" && event !== null && "workId" in event)).toEqual([
			{ kind: "done", workId: "one" },
		]);
		expect(daemon.followerOutput("follow")).toBe(summary);
		expect(daemon.providerLaunches()).toEqual([worker.attempts[0]?.operationId]);
		expect(daemon.boardFiles("responses").filter((file) => file.startsWith("fleet-report."))).toEqual([`${completed.report?.itemId}.md`]);
	},
);

import { expect } from "@effect/vitest";
import { Clock, Effect } from "effect";
import { host } from "#test/hostStory.ts";
import { statusScaleRecords } from "#test/statusScaleRecords.ts";

host.it(
	"2,000 durable records keep overview and follow responsive while detailed status retains the full record",
	[],
	function* (daemon) {
		const records = statusScaleRecords();
		yield* daemon.storeRecords(records);
		yield* daemon.stop();
		yield* daemon.start();
		const started = yield* Clock.currentTimeMillis;
		const overview = yield* daemon.requestStatus();
		expect((yield* Clock.currentTimeMillis) - started).toBeLessThan(2000);
		expect(overview.active.map((record) => record.workId)).toEqual(records.slice(1, 100).map((record) => record.workId));
		expect(overview.waiting.maintainer).toMatchObject([
			{
				attentionOwner: "maintainer",
				blocker: "Choose the synthetic storage option",
				links: ["https://github.com/example/project/pull/1"],
				stage: "needs-human",
				workId: "item-0000",
			},
		]);
		expect(overview.completed.map((record) => record.workId)).toEqual(
			records
				.slice(-50)
				.toReversed()
				.map((record) => record.workId),
		);
		const encoded = JSON.stringify(overview);
		for (const field of ["prompt", "boardContext", "output", "history", "publicationWork"]) {
			expect(encoded).not.toContain(`"${field}":`);
		}
		for (const text of ["Implement the approved synthetic change", "Synthetic Board context", "Synthetic worker progress"]) {
			expect(encoded).not.toContain(text);
		}
		const detail = yield* daemon.requestStatus("item-0000");
		expect(detail.record).toEqual(records[0]);
		expect((yield* daemon.requestStatus("item-0100")).record).toEqual(records[100]);
		const successfulExit = 0;
		const detailCli = yield* daemon.cli(["status", "item-0000", "--json"]);
		expect(detailCli.code).toBe(successfulExit);
		expect(JSON.parse(detailCli.stdout).record).toEqual(JSON.parse(JSON.stringify(records[0])));
		const cli = yield* daemon.cli(["status", "--json"]);
		expect(cli.code).toBe(successfulExit);
		expect(JSON.parse(cli.stdout).completed).toEqual(overview.completed);
		yield* Effect.all([daemon.requestStatus(), daemon.subscribe(["item-0001"])], { concurrency: "unbounded" });
		yield* daemon.follow("watcher", "watch", ["item-0000"], { follow: true });
		yield* Effect.all(
			[daemon.requestStatus(), daemon.awaitOutput("watcher", "item-0000 needs-human (waiting on maintainer): Choose the synthetic storage option")],
			{ concurrency: "unbounded" },
		).pipe(Effect.timeout("5 seconds"));
		expect(daemon.followerRunning("watcher")).toBe(true);
		expect(daemon.snapshots()).toMatchObject([[{ stage: "executing", workId: "item-0001" }]]);
	},
	60_000,
);

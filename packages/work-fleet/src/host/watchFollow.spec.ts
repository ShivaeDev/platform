import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { daemonClient } from "#host/daemonClient.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { statusRecord } from "#test/status.ts";
import { storeState } from "#test/storeState.ts";

const test = postgresTests("live");

const launchStory = Effect.fn("WatchFollowTest.launchStory")(function* (fixture: HostFixture, port: number, snapshot: Promise<void>) {
	yield* withFollower(fixture.configFile, "watch", [], { follow: true, port }, (follower) =>
		Effect.gen(function* () {
			const client = yield* daemonClient(port);
			yield* Effect.promise(() =>
				Promise.race([
					snapshot,
					follower.done.then((result) => {
						throw new Error(`Follower exited before subscribing: ${result.stderr}`);
					}),
				]),
			);
			yield* Effect.sleep("100 millis");
			expect(follower.isRunning()).toBe(true);
			expect(follower.output()).toBe("");
			yield* storeState(fixture.host, "a", {
				...statusRecord("a", "needs-human"),
				decision: { attentionOwner: "orchestrator", id: "first", links: [], reason: "Choose the next step", recommendation: "retry" },
			});
			yield* untilOutput(follower, "a needs-human (waiting on orchestrator): Choose the next step\n");
			expect((yield* client("daemon.dispatch", { workId: "b" })).stage).toBe("executing");
			expect(fixture.provider.launched).toHaveLength(1);
			yield* storeState(fixture.host, "b", { stage: "completed" });
			yield* untilOutput(follower, "b completed\n");
			yield* storeState(fixture.host, "a", {
				decision: { attentionOwner: "maintainer", code: "reviewed-pr-ready", id: "second", reason: "Ready to merge" },
				stage: "needs-human",
			});
			yield* untilOutput(follower, "a needs-human (waiting on maintainer): Ready to merge\n");
			yield* Effect.sleep("100 millis");
			expect(follower.output().trim().split("\n")).toEqual([
				"a needs-human (waiting on orchestrator): Choose the next step",
				"b completed",
				"a needs-human (waiting on maintainer): Ready to merge",
			]);
			expect(follower.isRunning()).toBe(true);
		}),
	);
});

test("watch --follow stays alive for new launches and repeated human decisions over HTTP", () =>
	withHost({ "b.md": task("b", "approved") }, {}, (fixture) => {
		const snapshot = Promise.withResolvers<void>();
		return withReadDaemon(
			fixture.host,
			(port) => launchStory(fixture, port, snapshot.promise),
			fixture.parts,
			() => snapshot.resolve(),
		);
	}));

test("watch --follow keeps explicit IDs and reports new decisions with identical text and repeated releases", function* () {
	yield* withHost({}, {}, (fixture) =>
		withFollower(fixture.configFile, "watch", ["a", "a"], { follow: true }, (follower) =>
			Effect.gen(function* () {
				yield* Effect.promise(() => follower.ready);
				const decision = { attentionOwner: "orchestrator", reason: "Choose the next step" };
				yield* storeState(fixture.host, "a", { decision: { ...decision, id: "first" }, stage: "needs-human" });
				yield* untilOutput(follower, "a needs-human (waiting on orchestrator): Choose the next step\n");
				yield* storeState(fixture.host, "other", { stage: "released" });
				yield* storeState(fixture.host, "a", { decision: { ...decision, id: "second" }, stage: "needs-human" });
				const line = "a needs-human (waiting on orchestrator): Choose the next step\n";
				yield* untilOutput(follower, line.repeat(2));
				yield* storeState(fixture.host, "a", { stage: "released" });
				yield* untilOutput(follower, `${line.repeat(2)}a released\n`);
				yield* storeState(fixture.host, "a", { stage: "executing" });
				yield* Effect.sleep("100 millis");
				yield* storeState(fixture.host, "a", { stage: "released" });
				yield* untilOutput(follower, `${line.repeat(2)}a released\na released\n`);
				expect(follower.output()).toBe(`${line.repeat(2)}a released\na released\n`);
				expect(follower.isRunning()).toBe(true);
			}),
		),
	);
});

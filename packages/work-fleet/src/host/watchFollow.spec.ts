import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { daemonClient } from "#host/daemonClient.ts";
import { dispatchAndWait } from "#test/daemonActions.ts";
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
				...statusRecord("a", "waiting"),
				decision: { attentionOwner: "orchestrator", id: "first", links: [], reason: "Choose the next step", recommendation: "retry" },
			});
			yield* untilOutput(follower, "a waiting (waiting on orchestrator): Choose the next step\n");
			expect((yield* dispatchAndWait(client, "b")).step).toBe("working");
			expect(fixture.provider.launched).toHaveLength(1);
			yield* storeState(fixture.host, "b", { stage: "done", step: "done" });
			yield* untilOutput(follower, "b done\n");
			yield* storeState(fixture.host, "a", {
				decision: { attentionOwner: "maintainer", code: "reviewed-pr-ready", id: "second", reason: "Ready to merge" },
				stage: "waiting",
				step: "waiting",
			});
			yield* untilOutput(follower, "a waiting (waiting on you): Ready to merge\n");
			yield* Effect.sleep("100 millis");
			expect(follower.output().trim().split("\n")).toEqual([
				"a waiting (waiting on orchestrator): Choose the next step",
				"b done",
				"a waiting (waiting on you): Ready to merge",
			]);
			expect(follower.isRunning()).toBe(true);
		}),
	);
});

test("watch --follow stays alive for new launches and repeated human decisions over HTTP", () =>
	withHost({ "b.md": task("b", "approved") }, {}, (fixture) => {
		const snapshot = Promise.withResolvers<void>();
		return withReadDaemon(fixture.host, (port) => launchStory(fixture, port, snapshot.promise), {
			onSnapshot: () => snapshot.resolve(),
			parts: fixture.parts,
		});
	}));

test("watch --follow keeps explicit IDs and reports new decisions with identical text and repeated releases", function* () {
	yield* withHost({}, {}, (fixture) =>
		withFollower(fixture.configFile, "watch", ["a", "a"], { follow: true }, (follower) =>
			Effect.gen(function* () {
				yield* Effect.promise(() => follower.ready);
				const decision = { attentionOwner: "orchestrator", reason: "Choose the next step" };
				yield* storeState(fixture.host, "a", { decision: { ...decision, id: "first" }, stage: "waiting", step: "waiting" });
				yield* untilOutput(follower, "a waiting (waiting on orchestrator): Choose the next step\n");
				yield* storeState(fixture.host, "other", { stage: "released", step: "released" });
				yield* storeState(fixture.host, "a", { decision: { ...decision, id: "second" }, stage: "waiting", step: "waiting" });
				const line = "a waiting (waiting on orchestrator): Choose the next step\n";
				yield* untilOutput(follower, line.repeat(2));
				yield* storeState(fixture.host, "a", { stage: "released", step: "released" });
				yield* untilOutput(follower, `${line.repeat(2)}a released\n`);
				yield* storeState(fixture.host, "a", { stage: "working", step: "working" });
				yield* Effect.sleep("100 millis");
				yield* storeState(fixture.host, "a", { stage: "released", step: "released" });
				yield* untilOutput(follower, `${line.repeat(2)}a released\na released\n`);
				expect(follower.output()).toBe(`${line.repeat(2)}a released\na released\n`);
				expect(follower.isRunning()).toBe(true);
			}),
		),
	);
});

for (const ids of [[], ["a"]]) {
	test(`watch --follow with ${ids.length === 0 ? "all" : "explicit"} IDs reports the same ready decision again after repair`, function* () {
		yield* withHost({}, {}, (fixture) =>
			withFollower(fixture.configFile, "watch", ids, { follow: true }, (follower) =>
				Effect.gen(function* () {
					yield* Effect.promise(() => follower.ready);
					const decision = { attentionOwner: "maintainer", code: "reviewed-pr-ready", reason: "Reviewed PR is ready to merge" };
					const line = "a waiting (waiting on you): Reviewed PR is ready to merge\n";
					yield* storeState(fixture.host, "a", { decision, stage: "waiting", step: "waiting" });
					yield* untilOutput(follower, line);
					yield* storeState(fixture.host, "a", { decision, stage: "working", step: "repairing" });
					yield* Effect.sleep("100 millis");
					yield* storeState(fixture.host, "a", { decision, stage: "waiting", step: "waiting" });
					yield* untilOutput(follower, line.repeat(2));
					expect(follower.output()).toBe(line.repeat(2));
					expect(follower.isRunning()).toBe(true);
				}),
			),
		);
	});
}

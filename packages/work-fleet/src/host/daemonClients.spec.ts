import { expect } from "@effect/vitest";
import { Context, Effect, Exit, Layer, Scope } from "effect";
import { HttpServer } from "effect/unstable/http";
import { it } from "@shivaedev/effect-test/it.ts";
import { admitApproved } from "#host/admission.ts";
import { hostLayer } from "#host/commands.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type HostFixture, storeState, task, withHost } from "#test/fleetHost.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { readDaemonLayer, withReadDaemon } from "#test/readDaemon.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const dispatchStory = Effect.fn("DaemonClientsTest.dispatchStory")(function* (fixture: HostFixture, port: number) {
	yield* admitApproved(fixture.host).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
	fixture.write("one.md", task("one", "approved", "Edited approved revision."));
	fixture.write("unused.json", JSON.stringify({ database: { url: "postgresql://unavailable" }, provider: "local" }));
	function dispatch(id: string) {
		return Effect.promise(() => cliProcess(["dispatch", id, "--port", String(port), "--config", `${fixture.host.boardDir}/unused.json`]));
	}
	expect(yield* dispatch("one")).toEqual({ code: 0, stdout: "one executing" });
	expect(fixture.provider.launched).toHaveLength(1);
	expect([...fixture.provider.observations.values()][0]?.output).toContain("Edited approved revision.");
	expect((yield* dispatch("denied")).code).toBe(1);
	expect(fixture.provider.launched).toHaveLength(1);
});

const restartStory = Effect.fn("DaemonClientsTest.restartStory")(function* (fixture: HostFixture) {
	const snapshot = Promise.withResolvers<void>();
	const first = yield* Scope.make();
	yield* Effect.addFinalizer(() => Scope.close(first, Exit.void));
	const context = yield* Layer.buildWithScope(
		readDaemonLayer(fixture.host, fixture.parts, 0, () => snapshot.resolve()),
		first,
	);
	const address = Context.get(context, HttpServer.HttpServer).address;
	if (address._tag !== "TcpAddress") {
		return yield* Effect.die("Expected a TCP daemon");
	}
	yield* storeState(fixture.host, "a", { stage: "executing" });
	yield* storeState(fixture.host, "b", { stage: "executing" });
	yield* withFollower(fixture.configFile, "watch", [], { interval: 0.1, port: address.port }, (follower) =>
		Effect.gen(function* () {
			yield* Effect.promise(() => snapshot.promise);
			yield* storeState(fixture.host, "a", { stage: "released" });
			yield* untilOutput(follower, "a released\n");
			yield* Scope.close(first, Exit.void);
			yield* storeState(fixture.host, "b", { stage: "completed" });
			yield* storeState(fixture.host, "new", { stage: "executing" });
			yield* Layer.build(readDaemonLayer(fixture.host, fixture.parts, address.port));
			expect(yield* Effect.promise(() => follower.done)).toMatchObject({ code: 0, stderr: "", stdout: "a released\nb completed" });
		}),
	);
}, Effect.scoped);

const test = it.live.skipIf(storageDatabaseUrl === undefined);

test(
	"HTTP dispatch prepares approved work, rejects unapproved work and re-approves edited revisions",
	() =>
		withHost({ "denied.md": task("denied"), "one.md": task("one", "approved") }, {}, (fixture) =>
			withReadDaemon(fixture.host, (port) => dispatchStory(fixture, port), fixture.parts),
		),
	30_000,
);

test("watch resyncs after the HTTP daemon restarts, preserving the selected set and printed outcomes", () => withHost({}, {}, restartStory), 30_000);

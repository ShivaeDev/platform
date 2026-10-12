import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber, Layer } from "effect";
import { cycle, run } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { statusLayer } from "#host/statusLayer.ts";
import { boardHttp } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { blockedStatus } from "#test/status.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = postgresTests("live");
const isolated = postgresTests("live", "isolated");

for (const denyDelivery of [false, true]) {
	test(`scheduler publication follows ${denyDelivery ? "human intervention" : "completion"} and leaves authored status untouched`, () =>
		withFleetBoard({ denyDelivery }, (fixture, root, source) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* cycle;
				function read() {
					return readFileSync(join(root, "fleet/status.md"), "utf8");
				}
				expect(read()).toContain("Stage: executing");
				const { client } = yield* boardHttp(root, "fleet/status.md");
				const page = client.api.page.query({ url: "/fleet/status.md" });
				const unmount = client.registry.mount(page);
				yield* Effect.addFinalizer(() => Effect.sync(unmount));
				const initial = yield* Effect.tryPromise(() => client.read(page));
				expect(initial.html).toContain('class="board"');
				expect(initial.html).toContain('href="/_board/item/one"');
				finishWorkers(fixture);
				yield* cycle;
				const stage = denyDelivery ? "needs-human" : "completed";
				expect((yield* (yield* Fleet).get("one")).value.stage).toBe(stage);
				expect(read()).toContain(`Stage: ${stage}`);
				expect(read()).toContain("[PR](<https://example.invalid/pr/one>)");
				yield* Effect.gen(function* () {
					while (true) {
						const refreshed = client.registry.get(page);
						if (refreshed._tag === "Success" && refreshed.value.html.includes(`Stage: ${stage}`)) {
							break;
						}
						yield* Effect.sleep("10 millis");
					}
				}).pipe(Effect.timeout("5 seconds"));
				expect(readFileSync(join(root, "one.md"), "utf8")).toBe(source);
			}).pipe(Effect.provide(statusLayer(root).pipe(Layer.provide(NodeServices.layer)))),
		));
}

isolated("run publishes a suspended validation stage without waiting for reconciliation to finish", function* () {
	const entered = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const checksGate = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)));
	yield* withFleetBoard({ checksGate }, (fixture, root) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			yield* cycle;
			finishWorkers(fixture);
			const scheduler = yield* Effect.scoped(run("5 millis")).pipe(Effect.forkChild);
			yield* Deferred.await(entered);
			yield* Effect.gen(function* () {
				while (!readFileSync(join(root, "fleet/status.md"), "utf8").includes("Stage: validating")) {
					yield* Effect.sleep("10 millis");
				}
			}).pipe(Effect.timeout("5 seconds"));
			yield* Fiber.interrupt(scheduler);
		}).pipe(Effect.provide(statusLayer(root).pipe(Layer.provide(NodeServices.layer)))),
	);
});

test("a failed publication keeps execution usable and the next scheduler cycle repairs the view", () =>
	withFleetBoard({}, (fixture, root, source) =>
		Effect.gen(function* () {
			const heal = yield* blockedStatus(root);
			yield* prepareWork("one");
			yield* cycle;
			expect((yield* (yield* Fleet).get("one")).value.stage).toBe("executing");
			yield* Effect.sync(heal);
			finishWorkers(fixture);
			yield* cycle;
			expect(readFileSync(join(root, "fleet/status.md"), "utf8")).toContain("Stage: completed");
			expect(readFileSync(join(root, "one.md"), "utf8")).toBe(source);
		}).pipe(Effect.provide(statusLayer(root).pipe(Layer.provide(NodeServices.layer)))),
	));

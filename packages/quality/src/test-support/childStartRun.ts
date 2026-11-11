import { rmSync } from "node:fs";
import { Deferred, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#adapters/runMain.ts";
import { loadConfig } from "#config/load.ts";
import { resolveRules } from "#config/resolve.ts";
import { validOrFail } from "#decoded.ts";
import { childStarted } from "#engine/childStarted.ts";
import { scan } from "#engine/session.ts";
import { defineRule } from "#rule.ts";
import { seedTree } from "#testing/adapters/tree.ts";

// The child check yields before it starts its child, as Biome and Knip do while they prepare, so an in-process rule run beside it would come first.
function childCheck(order: string[], ruled: Deferred.Deferred<void>) {
	return defineRule({
		check: () =>
			Effect.gen(function* () {
				yield* Effect.yieldNow;
				order.push("child started");
				yield* childStarted();
				yield* Deferred.await(ruled);
				order.push("child finished");
				return [];
			}),
		description: "Starts a child process.",
		id: "local/child",
		needs: "child-process",
	});
}

function inProcessCheck(order: string[], ruled: Deferred.Deferred<void>) {
	return defineRule({
		check: () => Effect.sync(() => order.push("in-process rule")).pipe(Effect.andThen(Deferred.succeed(ruled, undefined)), Effect.as([])),
		description: "Runs in the Quality process.",
		id: "local/in-process",
	});
}

export const childStartRun = storyKit({
	*create() {
		const root = seedTree([{ content: '{"name":"app","version":"1.0.0","type":"module"}\n', path: "package.json" }]);
		yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
		const order: string[] = [];
		const ruled = yield* Deferred.make<void>();
		const config = yield* loadConfig(root, undefined);
		const local = yield* validOrFail("local rules", yield* resolveRules({ local: [inProcessCheck(order, ruled), childCheck(order, ruled)] }));
		const active = local.active.filter((rule) => rule.id.startsWith("local/"));
		return { check: scan({ ...config, active }), order };
	},
	inspect: ({ order }) => ({ order }),
	layer: services,
	name: "Quality child-process start",
	stages: [],
	verbs: ({ check, order }, story) => ({
		order: () => Effect.sync(() => [...order]),
		runs: () => {
			story.tell("quality runs a check that starts a child process and a rule that runs in its own process");
			return Effect.asVoid(check);
		},
	}),
});

import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { Effect, Exit, Scope } from "effect";
import * as VitestNode from "vitest/node";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";

function startRunner() {
	return VitestNode.createVitest(
		{
			config: false,
			include: ["src/test-support/idle-clients/worker*.ts"],
			maxWorkers: 4,
			reporters: [],
			root: fileURLToPath(new URL("../..", import.meta.url)),
			testTimeout: 30_000,
			watch: false,
		},
		{
			resolve: { conditions: ["source"] },
			ssr: { resolve: { conditions: ["source"] } },
		},
		{ stderr: new PassThrough(), stdout: new PassThrough() },
	);
}

export const parallelApps = storyKit({
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const scope = yield* Scope.fork(yield* Scope.Scope);
			const runner = yield* Effect.acquireRelease(Effect.promise(startRunner), (resource) => Effect.promise(() => resource.close())).pipe(
				Scope.provide(scope),
			);
			return { runner, scope };
		}),
	name: "parallel apps",
	stages: ["workers"],
	verbs: ({ runner, scope }) => ({
		close: () => Scope.close(scope, Exit.void),
		run: () => Effect.promise(() => runner.start()),
		unhandledErrors: () => runner.state.getUnhandledErrors(),
	}),
});

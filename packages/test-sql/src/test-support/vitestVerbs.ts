import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import * as VitestNode from "vitest/node";

function createConsumer() {
	return VitestNode.createVitest(
		{
			config: false,
			include: ["src/test-support/vitestConsumer.ts"],
			reporters: [],
			root: fileURLToPath(new URL("../..", import.meta.url)),
			watch: false,
		},
		{ resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["source"] } } },
		{ stderr: new PassThrough(), stdout: new PassThrough() },
	);
}

async function runConsumer(vitest: VitestNode.Vitest) {
	const { testModules } = await vitest.start();
	return {
		errors: [...testModules.flatMap((module) => module.errors()), ...vitest.state.getUnhandledErrors()],
		tests: testModules.flatMap((module) =>
			[...module.children.allTests()].map((test) => ({
				errors: (test.result().errors ?? []).map((error) => error.message),
				observed: test.meta().databaseConsumer,
				state: test.result().state,
			})),
		),
	};
}

export function vitestVerbs() {
	return {
		runConsumer: () =>
			Effect.acquireUseRelease(
				Effect.promise(createConsumer),
				(vitest) => Effect.promise(() => runConsumer(vitest)),
				(vitest) => Effect.promise(() => vitest.close()),
			),
	};
}

import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import * as VitestNode from "vitest/node";

async function run(include: string) {
	const vitest = await VitestNode.createVitest(
		{ config: false, include: [include], reporters: [], root: fileURLToPath(new URL("../..", import.meta.url)), watch: false },
		{ resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["source"] } } },
		{ stderr: new PassThrough(), stdout: new PassThrough() },
	);
	try {
		const { testModules } = await vitest.start();
		const errors = [...testModules.flatMap((module) => module.errors()), ...vitest.state.getUnhandledErrors()];
		if (errors.length > 0) {
			throw new AggregateError(errors, "The public database test runner failed to run its fixtures");
		}
		return testModules.flatMap((module) =>
			[...module.children.allTests()].map((test) => ({
				errors: (test.result().errors ?? []).map((error) => error.message),
				name: test.name,
				state: test.result().state,
			})),
		);
	} finally {
		await vitest.close();
	}
}

export function runDatabaseTesting(include: string) {
	let result: ReturnType<typeof run> | undefined;
	return (name: string, index = 0) =>
		Effect.promise(() => {
			result ??= run(include);
			return result;
		}).pipe(Effect.map((results) => results.filter((test) => test.name === name).at(index)));
}

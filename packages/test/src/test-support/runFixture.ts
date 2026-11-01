import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import type { Reporter } from "vitest/node";
import * as VitestNode from "vitest/node";

const root = fileURLToPath(new URL("../..", import.meta.url));

export interface FixtureRun {
	readonly env: Readonly<Record<string, string>>;
	readonly file: string;
	readonly reporter?: Reporter;
	readonly tests?: readonly string[];
}

export interface FixtureTest {
	readonly errorNames: readonly string[];
	readonly errors: readonly string[];
	readonly name: string;
	readonly state: string;
}

function exactly(names: readonly string[]) {
	return `^(?:${names.map((name) => name.replaceAll(/[$()*+.?[\\\]^{|}]/gu, "\\$&")).join("|")})$`;
}

export async function runFixture({ env, file, reporter, tests }: FixtureRun) {
	const vitest = await VitestNode.createVitest(
		{
			config: false,
			env: { ...env },
			include: [`src/test-support/${file}.ts`],
			reporters: reporter === undefined ? [] : [reporter],
			root,
			watch: false,
			...(tests === undefined ? {} : { testNamePattern: exactly(tests) }),
		},
		{ resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["source"] } } },
		{ stderr: new PassThrough(), stdout: new PassThrough() },
	);
	try {
		const { testModules } = await vitest.start();
		const moduleErrors = testModules.flatMap((module) => module.errors().map((error) => error.message));
		if (moduleErrors.length > 0) {
			throw new Error(`The fixture ${file} did not load: ${moduleErrors.join("\n")}`);
		}
		const results = testModules.flatMap((module) =>
			[...module.children.allTests()].map((test) => ({
				errorNames: (test.result().errors ?? []).map((error) => error.name ?? "(unnamed)"),
				errors: (test.result().errors ?? []).map((error) => error.message),
				name: test.name,
				state: test.result().state,
			})),
		);
		return { tests: results, unhandledErrors: vitest.state.getUnhandledErrors() };
	} finally {
		await vitest.close();
	}
}

import { PassThrough } from "node:stream";
import { Effect } from "effect";
import type { Reporter } from "vitest/node";
import * as VitestNode from "vitest/node";

export interface VitestRunOptions {
	readonly allowOnly?: boolean;
	readonly env?: Readonly<Record<string, string>>;
	readonly hookTimeout?: number;
	readonly include: string;
	readonly reporter?: Reporter;
	readonly root: string;
	readonly tests?: readonly string[];
}

function exactly(names: readonly string[]) {
	return `^(?:${names.map((name) => name.replaceAll(/[$()*+.?[\\\]^{|}]/gu, "\\$&")).join("|")})$`;
}

export function runVitest({ allowOnly = false, env = {}, hookTimeout, include, reporter, root, tests }: VitestRunOptions) {
	return Effect.acquireUseRelease(
		Effect.promise(() =>
			VitestNode.createVitest(
				{
					allowOnly,
					config: false,
					env: { ...env },
					...(hookTimeout === undefined ? {} : { hookTimeout }),
					include: [include],
					reporters: reporter === undefined ? [] : [reporter],
					root,
					watch: false,
					...(tests === undefined ? {} : { testNamePattern: exactly(tests) }),
				},
				{ resolve: { conditions: ["source"] }, ssr: { resolve: { conditions: ["source"] } } },
				{ stderr: new PassThrough(), stdout: new PassThrough() },
			),
		),
		(vitest) =>
			Effect.promise(async () => {
				const { testModules } = await vitest.start();
				return {
					moduleErrors: testModules.flatMap((module) => module.errors().map((error) => error.message)),
					tests: testModules.flatMap((module) =>
						[...module.children.allTests()].map((test) => ({
							errorNames: (test.result().errors ?? []).map((error) => error.name ?? "(unnamed)"),
							errors: (test.result().errors ?? []).map((error) => error.message),
							meta: test.meta(),
							name: test.name,
							state: test.result().state,
						})),
					),
					unhandledErrors: vitest.state.getUnhandledErrors(),
				};
			}),
		(vitest) => Effect.promise(() => vitest.close()),
	);
}

export type VitestRunResult = Effect.Success<ReturnType<typeof runVitest>>;
export type VitestTest = VitestRunResult["tests"][number];

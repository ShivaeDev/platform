import { type Context, Effect, type Layer } from "effect";
import type { GitHub } from "@shivaedev/github/GitHub.ts";
import { fixtureWorkspace } from "./fixtureWorkspace.ts";
import type { vitestFixture } from "./vitestFixture.ts";

export interface Workspace {
	github: (args: string[]) => string;
	githubLayer?: Layer.Layer<Context.Service.Identifier<typeof GitHub>>;
	jobs: unknown;
	logs: unknown[];
	vitest?: Awaited<ReturnType<typeof vitestFixture>>;
	readonly workspace: ReturnType<typeof fixtureWorkspace>;
}

export function workspace() {
	return Effect.acquireRelease(
		Effect.sync(
			(): Workspace => ({
				github: () => {
					throw new Error("main timings are unavailable");
				},
				jobs: {},
				logs: [],
				workspace: fixtureWorkspace(),
			}),
		),
		(engine) => Effect.sync(() => engine.workspace.close()),
	);
}

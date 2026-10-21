import { Effect } from "effect";
import { fixtureWorkspace } from "./fixtureWorkspace.ts";
import type { vitestFixture } from "./vitestFixture.ts";

export interface Workspace {
	github: (args: string[]) => string;
	jobs: unknown;
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
				workspace: fixtureWorkspace(),
			}),
		),
		(engine) => Effect.sync(() => engine.workspace.close()),
	);
}

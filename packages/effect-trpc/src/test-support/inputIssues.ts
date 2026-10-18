import type { StandardSchemaV1Error } from "@trpc/server";
import { Effect, Layer } from "effect";
import { makeRequestServices } from "#request-services.ts";
import { adapterHost } from "./adapterHost.ts";
import type { RouterEngine } from "./routerEngine.ts";
import { selectRouter } from "./routerSetup.ts";
import { trpc } from "./routerStory.ts";

type Issues = ConstructorParameters<typeof StandardSchemaV1Error>[0];

function* build(engine: RouterEngine, issues: Issues) {
	const { adapter, t } = yield* adapterHost(engine, Layer.empty);
	const input = t.procedure.input({
		"~standard": { validate: () => ({ issues }), vendor: "input fixture", version: 1 },
	});
	const router = t.router({
		save: adapter
			.procedure(
				input,
				makeRequestServices(() => Layer.empty),
			)
			.query(function* () {
				return yield* Effect.succeed("saved");
			}),
	});
	return { router, runWithServices: adapter.runWithServices };
}

export function inputIssues(issues: Issues) {
	return trpc.trait("router", "the input parser reports Standard Schema issues", (engine) => {
		selectRouter(engine, "inputIssues", (state) => Effect.gen(() => build(state, issues)));
	});
}

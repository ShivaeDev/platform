import * as Effect from "effect/Effect";
import type { TestContext } from "vitest";
import type { FailedTest } from "#internal/failureReport.ts";
import { describeFailure } from "#internal/render.ts";

export type FailureContext = Pick<TestContext, "onTestFailed" | "task">;

export const reportOnFailure = Effect.fnUntraced(function* (
	{ onTestFailed, task }: FailureContext,
	report: (test: FailedTest) => Effect.Effect<string, never, unknown>,
) {
	const run = Effect.runPromiseWith(yield* Effect.context<unknown>());
	onTestFailed(async ({ task: failedTask }) => {
		const failure = failedTask.result?.errors?.[0];
		if (failure !== undefined) {
			const appendix = await run(report({ file: task.file.filepath, name: task.name, stack: failure.stack }));
			failure.message = `${failure.message || describeFailure({ ...failure, message: "" })}\n\n${appendix}`;
		}
	});
});

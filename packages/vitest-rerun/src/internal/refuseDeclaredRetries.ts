import { relative } from "node:path";
import { Effect } from "effect";
import type { Files } from "#adapters/tasks.ts";
import { VitestRerunError } from "#error.ts";
import { testcases } from "#flakyTests.ts";
import { junitClassname } from "#internal/junitClassname.ts";

export const refuseDeclaredRetries = Effect.fn("VitestRerun.refuseDeclaredRetries")(function* (files: Files, root: string) {
	const offenders = files.flatMap((file) =>
		testcases(file.tasks).flatMap(({ name, task }) => {
			const count = typeof task.retry === "number" ? task.retry : (task.retry?.count ?? 0);
			return count > 0 ? [`${junitClassname(relative(root, file.filepath), file.projectName ?? "")} > ${name}`] : [];
		}),
	);
	if (offenders.length > 0) {
		return yield* Effect.fail(
			new VitestRerunError({
				message: `Retries are global only and recoveries are recorded in flaky-tests.json. Remove per-test and per-suite retry options: ${offenders.sort().join("; ")}`,
			}),
		);
	}
});

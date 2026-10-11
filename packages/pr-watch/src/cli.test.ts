import { execFile } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { Effect } from "effect";
import { expect } from "vitest";
import { effectApp } from "#test/services.ts";

effectApp("CLI keeps pending mergeability diagnostics on stderr alongside JSON events", function* (h) {
	yield* h.cycle;
	h.setPull(1, { merged: true, state: "closed" });
	h.setPull(2, { mergeable: null, "mergeable_state": "unknown" });
	const result = yield* Effect.promise(
		() =>
			new Promise<{ code: string | number; stderr: string; stdout: string }>((done) => {
				execFile(
					process.execPath,
					[
						"--conditions=source",
						resolve(import.meta.dirname, "cli.ts"),
						"--repo",
						h.options.repository,
						"1",
						"2",
						"--once",
						"--state",
						h.options.stateFile,
						"--api-url",
						h.options.apiUrl,
					],
					{ timeout: 5000 },
					(error, stdout, stderr) => done({ code: error?.code ?? 0, stderr, stdout }),
				);
			}),
	);
	expect(result.code).toBe(1);
	expect(result.stderr).toContain("Mergeability pending for PR #2");
	expect(
		result.stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line)),
	).toEqual([{ branch: "feature-1", event: "merged", number: 1, title: "Change 1" }]);
});

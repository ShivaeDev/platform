import { fork } from "node:child_process";
import { once } from "node:events";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { publish } from "./publish.ts";

for (const phase of ["temporary", "published"]) {
	boardStory.it(
		`recovers after killing a writer with a ${phase} file on the real filesystem`,
		[deferredServing, projectFiles({}, "the project has the stated publication files")],
		function* ({ notes }) {
			const child = fork(new URL("../../test-support/publicationChild.ts", import.meta.url), [notes.root, phase], {
				execArgv: ["--conditions=source"],
				stdio: ["ignore", "pipe", "pipe", "ipc"],
			});
			const exited = once(child, "exit");
			let diagnostics = "";
			child.stderr?.on("data", (chunk) => {
				diagnostics += String(chunk);
			});
			try {
				const reached = yield* Effect.promise(() =>
					Promise.race([once(child, "message").then(([message]) => message), exited.then(() => diagnostics)]),
				);
				expect(reached).toBe(phase);
			} finally {
				child.kill("SIGKILL");
				yield* Effect.promise(() => exited);
			}
			const files = yield* Effect.promise(() => readdir(join(notes.root, "responses")));
			expect(files.filter((name) => name.endsWith(".tmp"))).toHaveLength(1);
			expect(files.includes("response.interrupted.md")).toBe(phase === "published");
			yield* publish(notes.root, notes.root, "response.interrupted", "Retained feedback");
			expect(yield* Effect.promise(() => readFile(join(notes.root, "responses/response.interrupted.md"), "utf8"))).toBe("Retained feedback");
			expect((yield* Effect.flip(publish(notes.root, notes.root, "response.interrupted", "Conflicting feedback"))).message).toContain(
				"different content",
			);
			expect(yield* Effect.promise(() => readFile(join(notes.root, "responses/response.interrupted.md"), "utf8"))).toBe("Retained feedback");
		},
	);
}

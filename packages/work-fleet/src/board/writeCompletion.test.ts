import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { expect, vi } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { publication } from "@shivaedev/work-board/integration/publication.ts";
import { completionMarkdown } from "#board/completionMarkdown.ts";
import { markdownBoard } from "#board/markdown.ts";
import { writeCompletion } from "#board/writeCompletion.ts";
import { BoardGateway } from "#policy.ts";
import { completionFolder } from "#test/completionFolder.ts";

for (const location of ["root", "directory", "file"] as const) {
	it.effect(`refuses a symlink at the completion ${location} boundary`, () =>
		Effect.gen(function* () {
			const { fs, root, outside, source } = yield* completionFolder;
			const targets = { directory: `${root}/tasks`, file: `${root}/tasks/one.md`, root };
			const target = targets[location];
			yield* fs.remove(target, { recursive: true });
			yield* fs.symlink(location === "file" ? `${outside}/one.md` : outside, target);
			expect(yield* writeCompletion(root, root, "tasks/one.md", source, "replacement").pipe(Effect.flip)).toMatchObject({
				_tag: "ReportFileFailure",
			});
			expect(yield* fs.readFileString(`${outside}/one.md`)).toBe(source);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}

it.effect("rechecks source bytes after preparing the atomic replacement and removes the skipped temporary file", () =>
	Effect.gen(function* () {
		const { fs, root, source } = yield* completionFolder;
		const changed = `${source}A human edit.\n`;
		const validate = publication.validateDirectory;
		let validations = 0;
		const spy = vi.spyOn(publication, "validateDirectory").mockImplementation(async (...args) => {
			await validate(...args);
			if (args[2] !== `${root}/tasks`) {
				return;
			}
			validations += 1;
			if (validations === 2) {
				expect(await Effect.runPromise(fs.readFileString(`${root}/tasks/one.md`))).toBe(source);
				const files = await Effect.runPromise(fs.readDirectory(`${root}/tasks`));
				expect(files.filter((file) => file.endsWith(".tmp"))).toHaveLength(1);
				await Effect.runPromise(fs.writeFileString(`${root}/tasks/one.md`, changed));
			}
		});
		yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
		const content = completionMarkdown(source, "Done; PR #7 merged.") ?? "";
		yield* writeCompletion(root, root, "tasks/one.md", source, content);
		expect(validations).toBe(2);
		expect(yield* fs.readFileString(`${root}/tasks/one.md`)).toBe(changed);
		expect(yield* fs.readDirectory(`${root}/tasks`)).toEqual(["one.md"]);
	}).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("refuses a changed root and confines completion to the saved authored source path and identity", () =>
	Effect.gen(function* () {
		const { fs, root, outside, source } = yield* completionFolder;
		expect(yield* writeCompletion(root, outside, "tasks/one.md", source, "replacement").pipe(Effect.flip)).toMatchObject({
			_tag: "ReportFileFailure",
		});
		yield* Effect.gen(function* () {
			const board = yield* BoardGateway;
			yield* board.complete?.("one", `${root}/moved.md`, "Done; PR #7 merged.") ?? Effect.void;
			yield* fs.writeFileString(`${root}/tasks/one.md`, source.replace("id: one", "id: other"));
			expect(yield* board.complete?.("one", `${root}/tasks/one.md`, "Done; PR #7 merged.")?.pipe(Effect.flip) ?? Effect.void).toMatchObject({
				_tag: "BoardFailure",
			});
		}).pipe(Effect.provide(markdownBoard(root)));
		expect(yield* fs.readFileString(`${root}/tasks/one.md`)).toBe(source.replace("id: one", "id: other"));
	}).pipe(Effect.provide(NodeServices.layer)),
);

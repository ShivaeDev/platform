import { Effect } from "effect";
import { expect, vi } from "vitest";
import * as publication from "@shivaedev/work-board/server/responses/publicationDirectory.ts";
import { completionMarkdown } from "#board/completionMarkdown.ts";
import { boardFileStory } from "#test/boardFileStory.ts";

for (const authored of ["identity", "criterion"] as const) {
	boardFileStory.it(`refuses completion when a YAML alias would change the authored ${authored}`, [], function* ({ completion }) {
		const { fs, root, source } = completion;
		const anchored = source.replace("status: draft", "status: &bookkeeping planned");
		const aliased =
			authored === "identity"
				? anchored.replace("id: one", "id: *bookkeeping")
				: anchored.replace("next_action: Work", "next_action: Work\ncriteria: [{ id: behavior, text: *bookkeeping }]");
		yield* fs.writeFileString(`${root}/tasks/one.md`, aliased);
		yield* Effect.gen(function* () {
			expect(
				yield* completion.complete(authored === "identity" ? "planned" : "one", `${root}/tasks/one.md`, "Done; PR #7 merged.").pipe(Effect.flip),
			).toMatchObject({ _tag: "BoardFailure" });
		});
		expect(yield* fs.readFileString(`${root}/tasks/one.md`)).toBe(aliased);
	});
}

for (const location of ["root", "directory", "file"] as const) {
	boardFileStory.it(`refuses a symlink at the completion ${location} boundary`, [], function* ({ completion }) {
		const { fs, root, outside, source } = completion;
		const targets = { directory: `${root}/tasks`, file: `${root}/tasks/one.md`, root };
		const target = targets[location];
		yield* fs.remove(target, { recursive: true });
		yield* fs.symlink(location === "file" ? `${outside}/one.md` : outside, target);
		expect(yield* completion.publish(root, "tasks/one.md", source, "replacement").pipe(Effect.flip)).toMatchObject({
			_tag: "ReportFileFailure",
		});
		expect(yield* fs.readFileString(`${outside}/one.md`)).toBe(source);
	});
}

boardFileStory.it(
	"rechecks source bytes after preparing the atomic replacement and removes the skipped temporary file",
	[],
	function* ({ completion }) {
		const { fs, root, source } = completion;
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
		yield* completion.publish(root, "tasks/one.md", source, content);
		expect(validations).toBe(2);
		expect(yield* fs.readFileString(`${root}/tasks/one.md`)).toBe(changed);
		expect(yield* fs.readDirectory(`${root}/tasks`)).toEqual(["one.md"]);
	},
);

boardFileStory.it("refuses a changed root and confines completion to the saved authored source path and identity", [], function* ({ completion }) {
	const { fs, root, outside, source } = completion;
	expect(yield* completion.publish(outside, "tasks/one.md", source, "replacement").pipe(Effect.flip)).toMatchObject({
		_tag: "ReportFileFailure",
	});
	yield* Effect.gen(function* () {
		yield* completion.complete("one", `${root}/moved.md`, "Done; PR #7 merged.");
		yield* fs.writeFileString(`${root}/tasks/one.md`, source.replace("id: one", "id: other"));
		expect(yield* completion.complete("one", `${root}/tasks/one.md`, "Done; PR #7 merged.").pipe(Effect.flip)).toMatchObject({
			_tag: "BoardFailure",
		});
	});
	expect(yield* fs.readFileString(`${root}/tasks/one.md`)).toBe(source.replace("id: one", "id: other"));
});

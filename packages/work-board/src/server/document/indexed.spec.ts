import { Effect } from "effect";
import { expect, vi } from "vitest";
import * as metadata from "#server/metadata/model.ts";
import * as parsing from "#server/metadata/parse.ts";
import * as updates from "#server/metadata/updateModel.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { documentWorkspace } from "#test/documentWorkspace.ts";

boardStory.it(
	"opens indexed documents through HTTP and RPC without parsing or rebuilding the workspace, while still reading each selected file",
	[projectFiles(documentWorkspace(160)), deferredServing],
	function* ({ notes, start, connectClient }) {
		const reads: string[] = [];
		const board = yield* start({
			wrap: (fs) => ({
				...fs,
				readFileString: (path, encoding) =>
					Effect.suspend(() => {
						reads.push(path);
						return fs.readFileString(path, encoding);
					}),
			}),
		});
		const client = connectClient();
		yield* Effect.promise(() => client.run(client.api.document.run({ url: "/document-0.md" })));
		const parsed = vi.spyOn(parsing, "metadataParse");
		const built = vi.spyOn(metadata, "metadataModel");
		const updated = vi.spyOn(updates, "updateModel");
		try {
			reads.length = 0;
			for (const file of ["document-1.md", "document-2.md", "document-10.md"]) {
				const result = yield* Effect.promise(() => client.run(client.api.document.run({ url: `/${file}` })));
				expect(result.file).toBe(file);
				expect(result.reading?.backlinks).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "Markdown link" })]));
			}
			const response = yield* Effect.promise(() => fetch(`${board.url}/document-3.md`));
			expect(yield* Effect.promise(() => response.text())).toContain("data-board-react-root");
			expect(reads.map((path) => path.slice(notes.root.length + 1))).toEqual(["document-1.md", "document-2.md", "document-10.md", "document-3.md"]);
			expect(parsed).not.toHaveBeenCalled();
			expect(built).not.toHaveBeenCalled();
			expect(updated).not.toHaveBeenCalled();
		} finally {
			parsed.mockRestore();
			built.mockRestore();
			updated.mockRestore();
		}
	},
);

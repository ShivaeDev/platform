import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import { browserClient } from "#client/client.ts";
import { folder, rawGet, startBoard } from "#test/board.ts";

it.live.each([false, true])("resolves .md item identities through HTTP and RPC with colliding file: %s", function* (collision) {
	const notes = yield* Effect.acquireRelease(
		Effect.sync(() =>
			folder({
				"_board/item/missing.md": "# Unidentified file",
				...(collision ? { "_board/item/source.md": "# Colliding file" } : {}),
				"identified.md": "---\nid: source.md\n---\n# Identified item",
			}),
		),
		(resource) => Effect.sync(() => resource.remove()),
	);
	const board = yield* startBoard(notes.root);
	const client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(resource) => Effect.sync(() => resource.registry.dispose()),
	);
	for (const id of ["source.md", "source%2Emd"]) {
		for (const slash of ["", "/"]) {
			const url = `/_board/item/${id}${slash}`;
			const page = yield* rawGet(board, url);
			expect(page.status).toBe(200);
			expect(page.body).toContain('data-identity="source.md"');
			expect(page.body).toContain("Identified item");
			expect(page.body).not.toContain("Colliding file");
			const document = yield* Effect.promise(() => client.run(client.api.document.run({ url })));
			expect(document).toMatchObject({ file: "identified.md", identity: "source.md", source: "# Identified item" });
		}
	}
	for (const slash of ["", "/"]) {
		const url = `/_board/item/missing.md${slash}`;
		const missing = yield* rawGet(board, url);
		expect(missing.status).toBe(404);
		expect(missing.body).toContain("No item with ID missing.md");
		yield* Effect.promise(() => expect(client.run(client.api.document.run({ url }))).rejects.toBeInstanceOf(NotFound));
	}
});

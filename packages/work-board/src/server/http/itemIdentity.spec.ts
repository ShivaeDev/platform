import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";

for (const collision of [false, true]) {
	boardStory.it(
		`resolves .md identities and mounted reads with colliding file: ${collision}`,
		[
			projectFiles({
				"_board/item/missing.md": "# Unidentified file",
				...(collision ? { "_board/item/source.md": "# Colliding file" } : {}),
				"identified.md": "---\nid: source.md\n---\n# Identified item",
			}),
			deferredServing,
		],
		function* ({ start, get, connectClient, waitForConnection, editFile, waitUntil }) {
			yield* start();
			const client = connectClient();
			for (const id of ["source.md", "source%2Emd"]) {
				for (const slash of ["", "/"]) {
					const url = `/_board/item/${id}${slash}`;
					const page = yield* get(url);
					expect(page.status).toBe(HttpStatus.fromLiteral("OK"));
					const document = yield* Effect.promise(() => client.run(client.api.document.run({ url })));
					expect(document).toMatchObject({ file: "identified.md", identity: "source.md", source: "# Identified item" });
				}
			}
			const watched = ["/_board/item/source.md", "/_board/item/source.md/", "/_board/item/source%2Emd"].map((url) =>
				client.api.document.query({ url }),
			);
			const releases = watched.map((query) => client.registry.mount(query));
			for (const query of watched) {
				yield* Effect.promise(() => client.read(query));
			}
			yield* waitForConnection();
			editFile("identified.md", "---\nid: source.md\n---\n# Changed stable identity");
			yield* waitUntil(async () => {
				for (const query of watched) {
					expect((await client.read(query)).source).toContain("Changed stable identity");
				}
			});
			for (const release of releases) {
				release();
			}

			for (const slash of ["", "/"]) {
				const url = `/_board/item/missing.md${slash}`;
				const missing = yield* get(url);
				expect(missing.status).toBe(HttpStatus.fromLiteral("NotFound"));
				yield* Effect.promise(() => expect(client.run(client.api.document.run({ url }))).rejects.toBeInstanceOf(NotFound));
			}
		},
	);
}

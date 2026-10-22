import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { ownerAliasFixture } from "#test/migrationValuesFixture.ts";

boardStory.it(
	"folds owner aliases without case sensitivity and retains Marvin as the maintainer",
	[projectFiles(ownerAliasFixture), deferredServing],
	function* ({ migrate, start, rpc }) {
		migrate();
		expect(migrate()).toBe("Changed 0 files and 0 fields.\n");
		yield* start();
		const owners: string[] = [];
		for (const file of Object.keys(ownerAliasFixture)) {
			const document = yield* rpc((client) => client("work-board.document", { url: `/${file}` }));
			expect(document.diagnostics).toEqual([]);
			owners.push(document.metadata.owner ?? "missing");
		}
		expect(owners).toEqual(["marvin", "marvin", "marvin", "claude", "claude", "claude", "claude", "claude", "codex", "codex"]);
	},
);

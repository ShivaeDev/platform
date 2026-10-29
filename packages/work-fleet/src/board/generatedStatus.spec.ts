import { expect } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { vi } from "vitest";
import { board as metadata } from "@shivaedev/work-board/server/integration/board.ts";
import { withBoardReadPass } from "#board/readPass.ts";
import { statusMarkdown } from "#board/statusMarkdown.ts";
import { approvedWorkIds } from "#host/admission.ts";
import { resolveHost } from "#host/config.ts";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";

boardReadStory.it(
	"excludes generated status from task parsing and retains authored work at the same path",
	[hasBoardItems(1)],
	function* ({ fixture }) {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.makeDirectory(`${fixture.root}/fleet`);
		yield* fixture.write("fleet/status.md", statusMarkdown([]));
		const parse = vi.spyOn(metadata, "metadataParse");
		yield* Effect.addFinalizer(() => Effect.sync(() => parse.mockRestore()));
		const ids = approvedWorkIds(resolveHost(fixture.root, { database: syntheticDatabase, provider: "local" })).pipe(Effect.provide(fixture.services));
		expect(yield* withBoardReadPass(ids)).toEqual(["item.0"]);
		expect(parse).toHaveBeenCalledTimes(1);
		yield* fixture.write("fleet/status.md", fixture.source("authored.status"));
		expect(yield* withBoardReadPass(ids)).toEqual(["item.0", "authored.status"]);
		expect(parse).toHaveBeenCalledTimes(3);
	},
);

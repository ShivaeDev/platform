import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { ReportInspection } from "#engine/ReportInspection.ts";
import { MainSource, unchanged } from "#host/mainSource.ts";
import { type HostFixture, MAIN } from "#test/fleetHost.ts";

export function localBoardHost(fixture: HostFixture, { ignored = true, inside = true } = {}) {
	const root = fixture.host.boardDir;
	const repositoryRoot = inside ? root : join(root, "repository");
	const boardDir = join(root, "private", "board");
	mkdirSync(repositoryRoot, { recursive: true });
	mkdirSync(boardDir, { recursive: true });
	execFileSync("git", ["init", "--quiet", repositoryRoot]);
	if (ignored) {
		writeFileSync(join(repositoryRoot, ".gitignore"), "private/board/\n");
	}
	const main = MainSource.of({
		current: Effect.succeed(MAIN),
		observe: (preparation) => Effect.succeed(unchanged(preparation.baseRevision, MAIN)),
		refresh: Effect.succeed(MAIN),
		repositoryRoot,
	});
	return {
		host: { ...fixture.host, boardDir },
		parts: {
			...fixture.parts,
			board: Layer.merge(
				markdownBoard(boardDir).pipe(Layer.provide(NodeServices.layer)),
				Layer.succeed(ReportInspection)({ check: () => Effect.void }),
			),
			main: Layer.succeed(MainSource)(main),
		},
		write: (source: string) => writeFileSync(join(boardDir, "one.md"), source),
	};
}

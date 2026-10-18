import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { ReportInspection } from "#engine/ReportInspection.ts";
import type { HostFixture } from "#test/fleetHost.ts";
import { fixedMainSource } from "#test/mainSource.ts";

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
	return {
		host: { ...fixture.host, boardDir },
		parts: {
			...fixture.parts,
			board: Layer.merge(
				markdownBoard(boardDir).pipe(Layer.provide(NodeServices.layer)),
				Layer.succeed(ReportInspection)({ check: () => Effect.void }),
			),
			main: fixedMainSource({ repositoryRoot }),
		},
		write: (source: string) => writeFileSync(join(boardDir, "one.md"), source),
	};
}

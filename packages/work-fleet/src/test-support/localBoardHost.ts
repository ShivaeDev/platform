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
	const host = { ...fixture.host, boardDir };
	const parts = { ...fixture.parts, board: board(boardDir), main: fixedMainSource({ repositoryRoot }) };
	function write(file: string, source: string) {
		writeFileSync(join(boardDir, file), source);
	}
	return {
		fixture: (files: Readonly<Record<string, string>>): HostFixture => {
			for (const [file, source] of Object.entries(files)) {
				write(file, source);
			}
			return { ...fixture, host, parts, write };
		},
		host,
		parts,
		repositoryRoot,
		write: (source: string) => write("one.md", source),
	};
}

function board(boardDir: string) {
	return Layer.merge(markdownBoard(boardDir).pipe(Layer.provide(NodeServices.layer)), Layer.succeed(ReportInspection)({ check: () => Effect.void }));
}

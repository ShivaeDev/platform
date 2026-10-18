import { chmodSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { RpcTest } from "effect/rpc";
import { workRpcs } from "#rpc/contract.ts";
import { item } from "#server/mcp/queries.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { fullIndex } from "./fullIndex.ts";
import { inboxFixture } from "./inboxFixture.ts";
import { inMemoryBoard } from "./inMemoryBoard.ts";
import type { BoardEngine } from "./storyEngine.ts";

export function attentionVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		readAttention: (files: Readonly<Record<string, string>> = inboxFixture(), unavailable: readonly string[] = []) =>
			Effect.gen(function* () {
				tell(`the reader checks attention after an outside edit to ${Object.keys(files).join(", ")}`);
				for (const entry of readdirSync(engine.notes.root, { recursive: true, withFileTypes: true })) {
					if (entry.isFile() && entry.name.endsWith(".md")) {
						rmSync(join(entry.parentPath, entry.name));
					}
				}
				Object.entries(files).forEach(([path, source], index) => {
					engine.notes.write(path, source);
					utimesSync(join(engine.notes.root, path), index, index);
				});
				for (const path of unavailable) {
					engine.notes.write(path, "# Unreadable project source");
					chmodSync(join(engine.notes.root, path), 0o000);
				}
				try {
					return yield* fullIndex(engine.notes.root).pipe(Effect.provide(NodeServices.layer));
				} finally {
					for (const path of unavailable) {
						chmodSync(join(engine.notes.root, path), 0o644);
					}
				}
			}),
		readInbox: (snapshot: Snapshot) =>
			Effect.scoped(
				Effect.gen(function* () {
					tell("the reader checks the inbox through the shared Board runtime");
					const client = yield* RpcTest.makeClient(workRpcs, { flatten: true });
					return yield* client("work-board.inbox", undefined);
				}),
			).pipe(Effect.provide(inMemoryBoard({}, { home: undefined, index: Effect.succeed(snapshot) }))),
		readMcpItem: (files: Readonly<Record<string, string>>, id: string) =>
			Effect.scoped(
				Effect.gen(function* () {
					tell(`an agent reads ${id} through the Board MCP item tool`);
					return yield* item(yield* RpcTest.makeClient(workRpcs, { flatten: true }), id);
				}),
			).pipe(Effect.provide(inMemoryBoard(files, { home: undefined }))),
	};
}

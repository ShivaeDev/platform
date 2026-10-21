import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import type { Fleet } from "#fleet.ts";
import { BoardGateway } from "#policy.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { type EngineFixture, withEngine } from "#test/engine.ts";
import { scriptedBoard } from "#test/scriptedBoard.ts";

export const dependencySource = `---
id: one
kind: task
status: draft
next_action: Implement the work.
fleet: approved
criteria:
  - id: behavior
    text: The behavior works.
---
# Target

Implement the behavior.
`;
export const doneDependencySource = dependencySource.replace("status: draft", "status: done").replace("Implement the work.", "Work completed.");

export function withDependencyBoard<A, E>(
	options: EngineOptions,
	use: (fixture: EngineFixture, write: (source: string) => void) => Effect.Effect<A, E, typeof Fleet.Identifier>,
) {
	return Effect.acquireUseRelease(
		Effect.sync(() => {
			const root = mkdtempSync(join(tmpdir(), "fleet-dependency-"));
			writeFileSync(join(root, "one.md"), dependencySource);
			return root;
		}),
		(root) => {
			let respond: EngineFixture["respond"] = () => {
				throw new Error("Board must be initialized before responding");
			};
			const board = Layer.effect(BoardGateway)(
				Effect.gen(function* () {
					const markdown = yield* BoardGateway;
					const scripted = scriptedBoard(options, [], (id) => markdown.get(id));
					respond = scripted.respond;
					const gateway = yield* BoardGateway.pipe(Effect.provide(scripted.layer));
					return { ...gateway, get: markdown.get };
				}).pipe(Effect.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer)))),
			);
			for (const id of ["dependent", "two"]) {
				const relationship = id === "dependent" ? "relationships:\n  - kind: depends_on\n    target: one\n" : "";
				writeFileSync(join(root, `${id}.md`), `---\nid: ${id}\nkind: task\nfleet: approved\n${relationship}---\n# ${id}\n`);
			}
			return withEngine(
				options,
				(fixture) => use({ ...fixture, respond: (...args) => respond(...args) }, (source) => writeFileSync(join(root, "one.md"), source)),
				board,
			);
		},
		(root) => Effect.sync(() => rmSync(root, { force: true, recursive: true })),
	);
}

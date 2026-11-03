import { Effect, Layer } from "effect";
import { Workspace } from "@shivaedev/work-board/server/workspace.ts";
import { BoardIndex } from "#board/Index.ts";
import { BoardRoot, MarkdownBoard } from "#board/markdownGateway.ts";
import { headlessBoard } from "#board/workspace.ts";
import { BoardGateway } from "#policy.ts";

export function markdownBoard(root: string) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const existing = yield* Effect.serviceOption(BoardIndex);
			const workspace = yield* Effect.serviceOption(Workspace);
			const board = Layer.effect(BoardGateway)(MarkdownBoard).pipe(
				Layer.provide(MarkdownBoard.layer.pipe(Layer.provide(Layer.succeed(BoardRoot, root)))),
			);
			return existing._tag === "Some" && workspace._tag === "Some"
				? board.pipe(Layer.provide(Layer.merge(Layer.succeed(BoardIndex, existing.value), Layer.succeed(Workspace, workspace.value))))
				: board.pipe(Layer.provide(headlessBoard(root)));
		}),
	);
}

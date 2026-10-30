import { Context, type Effect } from "effect";
import type { board } from "@shivaedev/work-board/server/integration/board.ts";
import type { BoardSnapshot } from "#board/readPass.ts";
import type { BoardFailure } from "#policy.ts";

export class BoardIndex extends Context.Service<
	BoardIndex,
	{
		readonly index: Effect.Success<ReturnType<typeof board.watchIndex>>;
		readonly snapshot: Effect.Effect<BoardSnapshot, BoardFailure>;
	}
>()("@shivaedev/work-fleet/BoardIndex") {}

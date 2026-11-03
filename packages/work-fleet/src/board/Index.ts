import { Context, type Effect } from "effect";
import type { board } from "@shivaedev/work-board/server/integration/board.ts";

export class BoardIndex extends Context.Service<
	BoardIndex,
	{
		readonly index: Effect.Success<ReturnType<typeof board.watchIndex>>;
	}
>()("@shivaedev/work-fleet/BoardIndex") {}

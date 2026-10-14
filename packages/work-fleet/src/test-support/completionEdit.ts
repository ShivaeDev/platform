import { Effect } from "effect";
import type { BoardGateway } from "#policy.ts";

export function completionEdit(board: typeof BoardGateway.Service, edit: () => void): typeof BoardGateway.Service {
	return {
		...board,
		complete: (...args) =>
			board.get(args[0]).pipe(
				Effect.tap(() => Effect.sync(edit)),
				Effect.andThen(board.complete?.(...args) ?? Effect.void),
			),
	};
}

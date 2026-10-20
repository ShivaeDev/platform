import { Effect } from "effect";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import type { BoardGatewayService } from "#board/GatewayService.ts";
import type { BoardFailure, BoardWork } from "#policy.ts";

export const implementedGoals = Effect.fn("FleetBoard.implementedGoals")(function* (work: BoardWork, get: BoardGatewayService["get"]) {
	const goals: string[] = [];
	const seen = new Set([work.workId]);
	const visit = Effect.fnUntraced(function* (source: string): Effect.fn.Return<void, BoardFailure> {
		for (const relation of board.metadataParse(source).fields.relationships ?? []) {
			if (relation.kind !== "implements" || seen.has(relation.target)) {
				continue;
			}
			seen.add(relation.target);
			const linked = yield* get(relation.target);
			const parsed = board.metadataParse(linked.context);
			if (parsed.fields.kind === "goal") {
				goals.push(parsed.body.trim());
			}
			yield* visit(linked.context);
		}
	});
	yield* visit(work.context);
	return goals.join("\n\n");
});

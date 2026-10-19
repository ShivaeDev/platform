import { Clock, Effect } from "effect";
import { cardStatus } from "#browser/views/nowCard.ts";
import type { InboxProjection } from "#browser/views/schema.ts";
import { fileUrl } from "#files/url.ts";
import { responseUrl } from "#responses/url.ts";
import { identityUrl } from "#server/metadata/links.ts";
import type { BoardClient } from "./client.ts";

export const needsYou = Effect.fn("BoardMcp.needsYou")(function* (client: BoardClient) {
	const inbox = yield* client("work-board.inbox", undefined);
	const now = yield* Clock.currentTimeMillis;
	const you = yield* Effect.forEach(inbox.you, (row) =>
		Effect.gen(function* () {
			const document = yield* client("work-board.document", { url: fileUrl(row.file) });
			const decision = document.requests.find((entry) => responseUrl(document.metadata.id ?? "", entry.id) === row.href);
			return {
				...row,
				ageMs: row.modified === undefined ? null : Math.max(0, now - row.modified),
				options: (decision ? decision.options : document.metadata.options) ?? [],
				prompts: decision?.prompts ?? [],
				promptUnavailable: decision?.promptUnavailable,
				recommended: decision?.recommended ?? document.metadata.recommended,
			};
		}),
	);
	return { complete: inbox.complete, issues: inbox.issues, you };
});

export const overview = Effect.fn("BoardMcp.overview")(function* (client: BoardClient) {
	const { fleet, goals, needs } = yield* Effect.all(
		{
			fleet: client("work-board.fleetItems", undefined),
			goals: client("work-board.goals", undefined),
			needs: needsYou(client),
		},
		{ concurrency: "unbounded" },
	);
	return {
		fleet: fleet.state === "ready" ? { items: fleet.items, state: fleet.state } : fleet,
		goals: { closedGoals: goals.closedGoals, deferredGoals: goals.deferredGoals, goals: goals.goals },
		needsYou: { count: needs.you.length, ...needs },
	};
});

export const item = Effect.fn("BoardMcp.item")(function* (client: BoardClient, id: string) {
	const document = yield* client("work-board.document", { url: identityUrl(id) });
	const fleet = yield* client("work-board.fleetItems", undefined);
	const inbox: InboxProjection = yield* client("work-board.inbox", undefined);
	const held =
		fleet.state === "ready" ? [...fleet.items, ...fleet.completed].find((entry) => entry.workId === id && entry.stage !== "released") : undefined;
	return {
		criteria: document.metadata.criteria ?? [],
		fleet: fleet.state === "ready" ? { item: held ?? null, state: fleet.state } : fleet,
		id,
		openDecisions: document.requests.filter((request) => request.open),
		owner: document.metadata.owner,
		relationships: document.metadata.relationships ?? [],
		status: cardStatus(
			document.metadata,
			held,
			inbox.you.find((row) => row.id === id)?.reason,
			inbox.answered.some((row) => row.id === id),
		),
	};
});

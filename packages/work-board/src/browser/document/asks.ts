import type { Metadata } from "#metadata/schema.ts";
import type { RequestState } from "./schema.ts";

interface AskedItem<TRequest extends RequestState> {
	readonly metadata: Metadata;
	readonly requests?: readonly TRequest[] | undefined;
}

export function itemAsks<TRequest extends RequestState>(item: AskedItem<TRequest>): readonly TRequest[] {
	const fields = item.metadata;
	return (item.requests ?? []).filter(
		(request) => request.open || (request.id === "answer" && request.sourceOpen && fields.kind === "question" && fields.question === undefined),
	);
}

export function askStatus(item: AskedItem<RequestState>): "needs-you" | "waiting-on-agents" | undefined {
	if (waitsOnYou(item)) {
		return "needs-you";
	}
	return itemAsks(item).length > 0 ? "waiting-on-agents" : undefined;
}

// Today splits asks by who answers them; an open ask only for agents does not wait on the reader.
export function waitsOnYou(item: AskedItem<RequestState>): boolean {
	return itemAsks(item).some((request) => request.audience === "you" && request.answered === undefined);
}

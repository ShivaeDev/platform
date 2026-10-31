import { Effect } from "effect";
import { requestCursor, type WireRequest } from "#test/codex.ts";

class InTurn {
	readonly replies: readonly unknown[];
	constructor(replies: readonly unknown[]) {
		this.replies = replies;
	}
}
class ByCursor {
	readonly pages: Readonly<Record<string, unknown>>;
	constructor(pages: Readonly<Record<string, unknown>>) {
		this.pages = pages;
	}
}
class Later {
	readonly milliseconds: number;
	readonly reply: unknown;
	constructor(milliseconds: number, reply: unknown) {
		this.milliseconds = milliseconds;
		this.reply = reply;
	}
}

export function later(milliseconds: number, reply: unknown) {
	return new Later(milliseconds, reply);
}

export function inTurn(...replies: readonly unknown[]) {
	return new InTurn(replies);
}

export function byCursor(pages: Readonly<Record<string, unknown>>) {
	return new ByCursor(pages);
}

export type WireScript = Readonly<Record<string, unknown>>;

export function scripted(
	script: WireScript,
	delay: (milliseconds: number, reply: unknown) => unknown = () => {
		throw new Error("This fake provider cannot delay replies");
	},
): (request: WireRequest) => unknown {
	const answered = new Map<string, number>();
	return (request) => {
		if (!(request.method in script)) {
			return {};
		}
		const reply = script[request.method];
		if (reply instanceof InTurn) {
			const count = answered.get(request.method) ?? 0;
			answered.set(request.method, count + 1);
			return reply.replies[count % reply.replies.length];
		}
		if (reply instanceof ByCursor) {
			return reply.pages[requestCursor(request) ?? "first"];
		}
		if (reply instanceof Later) {
			return delay(reply.milliseconds, reply.reply);
		}
		return reply;
	};
}

export function turn(id: string, status: string, operationId?: string) {
	return { id, items: operationId === undefined ? [] : [{ clientId: operationId, id: "input", type: "userMessage" }], status };
}

export function page(data: readonly unknown[], nextCursor: string | null = null) {
	return { data, nextCursor };
}

export function wireLog(requests: () => readonly WireRequest[]) {
	return {
		methods: (...only: readonly string[]) =>
			Effect.sync(() =>
				requests()
					.map(({ method }) => method)
					.filter((method) => (only.length === 0 ? method !== "initialize" && method !== "initialized" : only.includes(method))),
			),
		sent: (method: string) => Effect.sync(() => requests().flatMap((request) => (request.method === method ? [request.params] : []))),
	};
}

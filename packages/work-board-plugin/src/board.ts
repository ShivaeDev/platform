import type { WorkboardAsk, WorkboardBlock, WorkboardBoard } from "#types/index.d.ts";
import { flightsOf, goalsOf, goalTitlesOf } from "./answers.ts";
import { refusedLine, silentLine } from "./lines.ts";
import { isRecord, type RpcExit, type RpcInit, type RpcReply, readExits, records, rpcInit, text } from "./rpc.ts";

const QUERIES = ["inbox", "overview", "server"] as const;
type Query = (typeof QUERIES)[number];
type Exits = ReadonlyMap<Query, RpcExit>;

export function boardInit(directory: string): RpcInit {
	return rpcInit(
		directory,
		QUERIES.map((query) => ({ payload: null, tag: `work-board.${query}` })),
	);
}

export function readBoard(response: RpcReply, directory: string, now: number): WorkboardBoard {
	if (!response.ok) {
		return { kind: "error", message: refusedLine(response, directory) };
	}
	const exits = exitsByQuery(response.text);
	if (exits.size === 0) {
		return { kind: "error", message: silentLine(directory) };
	}
	const server = answerTo(exits, "server");
	const url = isRecord(server) && text(server.directory) !== undefined ? (text(server.url) ?? null) : null;
	const overview = answerTo(exits, "overview");
	const titles = goalTitlesOf(isRecord(overview) ? overview.goals : undefined);
	return {
		asks: block(exits, "inbox", (value) => asksOf(value, url)),
		flights: block(exits, "overview", (value) => flightsOf(isRecord(value) ? value.fleet : undefined, now, titles)),
		goals: block(exits, "overview", (value) => goalsOf(isRecord(value) ? value.goals : undefined)),
		kind: "ready",
	};
}

function exitsByQuery(stream: string): Exits {
	const exits = new Map<Query, RpcExit>();
	for (const [index, exit] of readExits(stream)) {
		const query = QUERIES[index];
		if (query !== undefined) {
			exits.set(query, exit);
		}
	}
	return exits;
}

function answerTo(exits: Exits, query: Query): unknown {
	const exit = exits.get(query);
	return exit !== undefined && "value" in exit ? exit.value : undefined;
}

function block<T>(exits: Exits, query: Query, read: (value: unknown) => WorkboardBlock<T>): WorkboardBlock<T> {
	const exit = exits.get(query);
	if (exit === undefined) {
		return { items: [], problem: "The Board sent no answer for this query." };
	}
	return "failure" in exit ? { items: [], problem: "The Board could not answer this query." } : read(exit.value);
}

function asksOf(value: unknown, boardUrl: string | null): WorkboardBlock<WorkboardAsk> {
	const rows = isRecord(value) ? records(value.you) : [];
	const seen = new Map<string, number>();
	const items = rows.map((row) => {
		const id = text(row.id) ?? text(row.file) ?? "ask";
		const count = seen.get(id) ?? 0;
		seen.set(id, count + 1);
		return {
			key: count === 0 ? `open:${id}` : `open:${id}:${count}`,
			title: text(row.title) ?? id,
			url: resolveUrl(text(row.href) ?? "/", boardUrl),
		};
	});
	return { items, problem: null };
}

function resolveUrl(href: string, base: string | null): string | null {
	if (/^https?:/u.test(href)) {
		return href;
	}
	if (base === null) {
		return null;
	}
	try {
		return new URL(href, base).href;
	} catch {
		return null;
	}
}

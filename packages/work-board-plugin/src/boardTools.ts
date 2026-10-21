import { flightsOf, goalsOf, goalTitlesOf } from "./answers.ts";
import { silentLine } from "./lines.ts";
import { fileUrl, identityUrl, isRecord, type RpcRequest, readExits, records, responseUrl, text } from "./rpc.ts";

export interface Board {
	ask: (requests: readonly RpcRequest[]) => Promise<unknown[]>;
	now: number;
}

export function query(name: string): RpcRequest {
	return { payload: null, tag: `work-board.${name}` };
}

export function documentAt(url: string): RpcRequest {
	return { payload: { url }, tag: "work-board.document" };
}

export function answersTo(requests: readonly RpcRequest[], stream: string, directory: string): unknown[] {
	const exits = readExits(stream);
	if (exits.size === 0) {
		throw new Error(silentLine(directory));
	}
	return requests.map((request, index) => {
		const exit = exits.get(index);
		if (exit === undefined) {
			throw new Error(`The Work Board for ${directory} sent no answer for ${request.tag}.`);
		}
		if ("failure" in exit) {
			throw new Error(failureLine(request, directory, exit.failure));
		}
		return exit.value;
	});
}

function failureLine(request: RpcRequest, directory: string, failure: string): string {
	const url = isRecord(request.payload) ? text(request.payload.url) : undefined;
	const id = url === undefined ? undefined : /^\/_board\/item\/(?<id>[^/]+)\/$/u.exec(url)?.groups?.id;
	const subject = id === undefined ? (url ?? request.tag) : `item ${decodeURIComponent(id)}`;
	return `The Work Board for ${directory} could not read ${subject}: ${failure}`;
}

export async function needsYou({ ask, now }: Board) {
	const [inbox] = await ask([query("inbox")]);
	const rows = records(isRecord(inbox) ? inbox.you : undefined);
	const documents = await ask(rows.map((row) => documentAt(fileUrl(text(row.file) ?? ""))));
	const you = rows.map((row, index) => {
		const document = isRecord(documents[index]) ? documents[index] : {};
		const metadata = isRecord(document.metadata) ? document.metadata : {};
		const decision = records(document.requests).find((entry) => responseUrl(text(metadata.id) ?? "", text(entry.id) ?? "") === row.href);
		return {
			...row,
			ageMs: typeof row.modified === "number" ? Math.max(0, now - row.modified) : null,
			options: (decision ? decision.options : metadata.options) ?? [],
			prompts: decision?.prompts ?? [],
			promptUnavailable: decision?.promptUnavailable,
			recommended: decision?.recommended ?? metadata.recommended,
		};
	});
	return { complete: isRecord(inbox) ? inbox.complete : undefined, issues: isRecord(inbox) ? inbox.issues : [], you };
}

export async function overview({ ask, now }: Board) {
	const [inbox, fleetItems, goalList] = await ask([query("inbox"), query("fleetItems"), query("goals")]);
	const you = records(isRecord(inbox) ? inbox.you : undefined).map((row) => ({ id: row.id, reason: row.reason, title: row.title }));
	const flights = flightsOf(fleetItems, now, goalTitlesOf(goalList));
	const goals = goalsOf(goalList).items;
	return {
		fleet:
			flights.problem === null
				? { items: flights.items, state: "ready" }
				: { reason: isRecord(fleetItems) ? fleetItems.reason : flights.problem, state: "unavailable" },
		goals: {
			done: goals.reduce((sum, goal) => sum + goal.done, 0),
			goals,
			total: goals.reduce((sum, goal) => sum + goal.total, 0),
		},
		needsYou: { complete: isRecord(inbox) ? inbox.complete : undefined, count: you.length, you },
	};
}

export async function item({ ask }: Board, id: string) {
	const [document, fleet] = await ask([documentAt(identityUrl(id)), query("fleetItems")]);
	const metadata = isRecord(document) && isRecord(document.metadata) ? document.metadata : {};
	const ready = isRecord(fleet) && fleet.state === "ready";
	const held = ready
		? [...records(fleet.items), ...records(fleet.completed)].find((entry) => entry.workId === id && entry.stage !== "released")
		: undefined;
	return {
		criteria: metadata.criteria ?? [],
		fleet: ready ? { item: held ?? null, state: "ready" } : fleet,
		id,
		openDecisions: records(isRecord(document) ? document.requests : undefined).filter((request) => request.open === true),
		owner: metadata.owner,
		relationships: metadata.relationships ?? [],
		status: text(metadata.status),
	};
}

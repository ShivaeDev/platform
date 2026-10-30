import type { EngineInterface, HttpResponse } from "claude-code";
import { platformClient } from "#adapters/platformClient.ts";
import type { Board } from "#boardTools.ts";
import { findBoard } from "#findBoard.ts";
import { refusedLine, waitingLine } from "#lines.ts";
import { isRecord, RPC_URL, readExits, rpcInit, text } from "#rpc.ts";
import type { WorkboardBoard } from "#types/index.d.ts";

const connections = new WeakMap<EngineInterface, Promise<ReturnType<typeof platformClient>>>();
export function connect($: EngineInterface): Promise<Board> {
	return Promise.all([connection($), $.clock.now()]).then(([live, now]) => ({ ask: live.ask, now }));
}

export function connection($: EngineInterface, changed: (board: WorkboardBoard) => void = () => undefined) {
	let current = connections.get($);
	if (current === undefined) {
		current = open($, changed);
		connections.set($, current);
	}
	return current;
}

async function open($: EngineInterface, changed: (board: WorkboardBoard) => void) {
	const cwd = await $.session.cwd();
	const directory = await findBoard($, cwd);
	if (directory === null) {
		throw new Error(waitingLine({ cwd, kind: "none" }));
	}
	let response: HttpResponse;
	try {
		response = await $.http.fetch(RPC_URL, rpcInit(directory, [{ payload: null, tag: "work-board.server" }]));
	} catch (cause) {
		throw new Error(waitingLine({ directory, kind: "down" }), { cause });
	}
	if (!response.ok) {
		throw new Error(refusedLine(response, directory));
	}
	const exit = readExits(response.text).get(0);
	const url = exit && "value" in exit && isRecord(exit.value) ? text(exit.value.url) : undefined;
	if (url === undefined) {
		throw new Error(`The Work Board for ${directory} did not say where it is served.`);
	}
	return platformClient(url, directory, $.clock.now, changed);
}

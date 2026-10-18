import type { EngineInterface, HttpResponse } from "claude-code";
import { answersTo, type Board } from "./boardTools.ts";
import { findBoard } from "./findBoard.ts";
import { refusedLine, waitingLine } from "./lines.ts";
import { RPC_URL, rpcInit } from "./rpc.ts";

export async function connect($: EngineInterface): Promise<Board> {
	const cwd = await $.session.cwd();
	const directory = await findBoard($, cwd);
	if (directory === null) {
		throw new Error(waitingLine({ cwd, kind: "none" }));
	}
	return { ask: askerFor($, directory), now: await $.clock.now() };
}

function askerFor($: EngineInterface, directory: string): Board["ask"] {
	return async function ask(requests) {
		if (requests.length === 0) {
			return [];
		}
		let response: HttpResponse;
		try {
			response = await $.http.fetch(RPC_URL, rpcInit(directory, requests));
		} catch (cause) {
			throw new Error(waitingLine({ directory, kind: "down" }), { cause });
		}
		if (!response.ok) {
			throw new Error(refusedLine(response, directory));
		}
		return answersTo(requests, response.text, directory);
	};
}

import type { EngineInterface, HttpResponse } from "claude-code";
import { platformClient } from "#adapters/platformClient.ts";
import type { Board } from "#boardTools.ts";
import { findBoard } from "#findBoard.ts";
import { refusedLine, waitingLine } from "#lines.ts";
import { RPC_URL, rpcPost } from "#rpc.ts";

type Client = ReturnType<typeof platformClient>;

async function post($: EngineInterface, directory: string, body: string): Promise<string> {
	let response: HttpResponse;
	try {
		response = await $.http.fetch(RPC_URL, rpcPost(directory, body));
	} catch (cause) {
		throw new Error(waitingLine({ directory, kind: "down" }), { cause });
	}
	if (!response.ok) {
		throw new Error(refusedLine(response, directory));
	}
	return response.text;
}

// Each read opens its own client on the caller's $, so a failed Board is asked again by the next read and no
// client outlives the dispatch or the module copy that made it.
export async function withClient<A>($: EngineInterface, use: (client: Client) => Promise<A>): Promise<A> {
	const cwd = await $.session.cwd();
	const directory = await findBoard($, cwd);
	if (directory === null) {
		throw new Error(waitingLine({ cwd, kind: "none" }));
	}
	const client = platformClient(
		directory,
		(body) => post($, directory, body),
		() => $.clock.now(),
	);
	try {
		return await use(client);
	} finally {
		client.close();
	}
}

export function withBoard<A>($: EngineInterface, read: (board: Board) => Promise<A>): Promise<A> {
	return withClient($, async (client) => read({ ask: client.ask, now: await $.clock.now() }));
}

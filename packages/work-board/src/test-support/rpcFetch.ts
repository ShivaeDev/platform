import type { BrowserWindow } from "happy-dom";
import type { PageRequests } from "./browser.ts";
import { RpcStream } from "./RpcStream.ts";
import { type RpcRequest, rpcRequest } from "./rpc.ts";

type Request = InstanceType<BrowserWindow["Request"]>;
type Response = InstanceType<BrowserWindow["Response"]>;
function nativeRequest(request: Request) {
	return new URL(request.url).pathname.replace(/\/$/u, "") === "/_board/rpc";
}
function pageRead(call: RpcRequest | undefined, path: string) {
	if (!call) {
		return false;
	}
	if (call.tag === "work-board.history") {
		return path === "/_board/changes";
	}
	if (call.tag === "work-board.diagnostics") {
		return path === "/_board/diagnostics";
	}
	if (call.tag === "work-board.library") {
		return path === "/_board/library";
	}
	if (call.tag === "work-board.goals") {
		return path === "/_board/goals";
	}
	if (call.tag === "work-board.start") {
		return path === "/_board/start";
	}
	if (call.tag === "work-board.inbox") {
		return path === "/_board/inbox";
	}
	if (call.tag === "work-board.overview") {
		return path === "/_board/overview";
	}
	return (
		["work-board.document", "work-board.board", "work-board.work", "work-board.respond", "work-board.handoff", "work-board.result"].includes(call.tag)
		&& JSON.stringify(call.payload).includes(JSON.stringify(path))
	);
}
async function answer(pageRequests: PageRequests, window: BrowserWindow) {
	pageRequests.count += 1;
	await pageRequests.gate;
	if (pageRequests.failWith === "network") {
		throw new TypeError("Failed to fetch");
	}
	if (pageRequests.failWith !== undefined) {
		return new window.Response("<p>An error page from a proxy</p>", { headers: { "content-type": "text/html" }, status: pageRequests.failWith });
	}
	return undefined;
}
export async function rpcBefore(
	request: Request,
	window: BrowserWindow,
	path: string,
	pageRequests: PageRequests,
	streams: RpcStream[],
	legacy = false,
) {
	if (legacy) {
		return answer(pageRequests, window);
	}
	if (!nativeRequest(request)) {
		return undefined;
	}
	const call = await rpcRequest(request);
	if (call?.tag === "work-board.subscribe") {
		streams[0] ??= new RpcStream();
		if (streams[0].blocked) {
			throw new Error("Subscription transport unavailable");
		}
	}
	if (pageRead(call, path)) {
		return answer(pageRequests, window);
	}
	return undefined;
}
export async function rpcAfter(
	request: Request,
	response: Response | null,
	window: BrowserWindow,
	path: string,
	pageRequests: PageRequests,
	streams: RpcStream[],
) {
	if (!nativeRequest(request)) {
		return undefined;
	}
	const call = await rpcRequest(request);
	if (call?.tag === "work-board.subscribe" && response !== null) {
		return streams[0]?.response(window, response, call.id);
	}
	if (!pageRead(call, path)) {
		return undefined;
	}
	pageRequests.answered += 1;
	const gate = pageRequests.responseGate;
	if (gate && response) {
		const body = await response.clone().arrayBuffer();
		await gate;
		return new window.Response(body, { headers: response.headers, status: response.status });
	}
	return undefined;
}

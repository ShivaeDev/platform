import type { RpcRequest } from "#test/rpc.ts";

export function pageRead(call: RpcRequest | undefined, path: string) {
	if (!call) {
		return false;
	}
	if (call.tag === "work-board.diagnostics") {
		return path === "/_board/system";
	}
	if (call.tag === "work-board.library") {
		return path === "/_board/library";
	}
	if (call.tag === "work-board.fleetItems") {
		return path === "/";
	}
	if (call.tag === "work-board.goals") {
		return path === "/_board/goals" || path === "/";
	}
	if (call.tag === "work-board.start") {
		return path === "/_board/start";
	}
	if (call.tag === "work-board.inbox") {
		return path === "/_board/inbox" || path === "/";
	}
	return (
		["work-board.document", "work-board.board", "work-board.work", "work-board.handoff", "work-board.result"].includes(call.tag)
		&& JSON.stringify(call.payload).includes(JSON.stringify(path))
	);
}

import type { RpcClientError } from "effect/rpc/RpcClientError";
import type { ResponseRejection } from "#rpc/rejections.ts";

export type SaveFailure = ResponseRejection | RpcClientError;

export function saveFailure(error: SaveFailure, kind: "response" | "handoff") {
	const outcome =
		error._tag === "PublicationUncertain" || error._tag === "InternalServerError" || error._tag === "RpcClientError" ? "uncertain" : "rejected";
	const retained =
		kind === "response"
			? "Draft retained. Preview and retry with the same identity; saved content will be reconciled."
			: "Draft retained; preview and retry.";
	return { outcome, text: `${outcome === "rejected" ? "Rejected" : "Uncertain"}: ${String(error)}. ${retained}` };
}

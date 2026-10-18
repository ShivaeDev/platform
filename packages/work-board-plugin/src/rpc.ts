export const RPC_URL = "http://localhost/_board/rpc";

export interface RpcRequest {
	payload: unknown;
	tag: string;
}
export type RpcExit = { value: unknown } | { failure: string };

export interface RpcInit {
	body: string;
	headers: Record<string, string>;
	method: "POST";
	socketPath: string;
}

export interface RpcReply {
	ok: boolean;
	status: number;
	text: string;
}

export function workFolder(directory: string): string {
	return `${directory === "/" ? "" : directory}/.work`;
}

export function rpcInit(directory: string, requests: readonly RpcRequest[]): RpcInit {
	const body = requests.map((request, index) =>
		JSON.stringify({ _tag: "Request", headers: [], id: String(index + 1), payload: request.payload, tag: request.tag }),
	);
	return {
		body: `${body.join("\n")}\n`,
		headers: { "content-type": "application/ndjson" },
		method: "POST",
		socketPath: `${workFolder(directory)}/board.sock`,
	};
}

export function readExits(stream: string): Map<number, RpcExit> {
	const exits = new Map<number, RpcExit>();
	for (const line of stream.split("\n")) {
		const message = parseLine(line);
		if (!isRecord(message) || message._tag !== "Exit" || typeof message.requestId !== "string") {
			continue;
		}
		const index = Number(message.requestId) - 1;
		if (!Number.isInteger(index) || index < 0 || !isRecord(message.exit)) {
			continue;
		}
		exits.set(index, message.exit._tag === "Success" ? { value: message.exit.value } : { failure: failureOf(message.exit.cause) });
	}
	return exits;
}

function failureOf(cause: unknown): string {
	const reasons = (Array.isArray(cause) ? cause : []).filter(isRecord).map((entry) => {
		const error = isRecord(entry.error) ? entry.error : {};
		return text(error.message) ?? text(error._tag) ?? text(entry._tag) ?? "unknown failure";
	});
	return reasons.length === 0 ? "unknown failure" : reasons.join("; ");
}

function parseLine(line: string): unknown {
	if (line.trim() === "") {
		return undefined;
	}
	try {
		return JSON.parse(line);
	} catch {
		return undefined;
	}
}

export function fileUrl(file: string): string {
	return `/${file.split("/").map(encodeURIComponent).join("/")}`;
}

export function identityUrl(id: string): string {
	return `/_board/item/${encodeURIComponent(id)}/`;
}

export function responseUrl(item: string, request: string): string {
	return `${identityUrl(item)}#${encodeURIComponent(`answer-card-${request}`)}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function text(value: unknown): string | undefined {
	return typeof value === "string" && value !== "" ? value : undefined;
}

export function records(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ? value.filter(isRecord) : [];
}

import { Effect, Predicate } from "effect";
import { words } from "#test/answers.ts";
import { type HostState, io } from "./state.ts";

export type AdminCaller = "member" | "signed-out caller";

export function rpcBody(tags: readonly string[]) {
	return `${tags.map((tag, index) => JSON.stringify({ _tag: "Request", headers: [], id: String(index + 1), payload: null, tag })).join("\n")}\n`;
}

function token(caller: AdminCaller) {
	return caller === "member" ? "member" : "";
}

function failureOf(exit: unknown): string {
	const cause = Predicate.hasProperty(exit, "cause") && Array.isArray(exit.cause) ? exit.cause : [];
	const failed = cause.find((reason: unknown) => Predicate.hasProperty(reason, "error"));
	const error: unknown = failed?.error;
	return Predicate.hasProperty(error, "_tag") ? `failed with ${words(String(error._tag))}` : "died";
}

export function answerOfMessage(message: unknown): string {
	if (!Predicate.hasProperty(message, "_tag")) {
		return `unreadable message ${JSON.stringify(message)}`;
	}
	if (message._tag === "Chunk" && Predicate.hasProperty(message, "values") && Array.isArray(message.values)) {
		return `streamed ${message.values.join(", ")}`;
	}
	if (message._tag === "Exit" && Predicate.hasProperty(message, "exit") && Predicate.hasProperty(message.exit, "_tag")) {
		return message.exit._tag === "Success" && Predicate.hasProperty(message.exit, "value") ? String(message.exit.value) : failureOf(message.exit);
	}
	return `unexpected ${String(message._tag)}`;
}

function answersOf(tags: readonly string[], text: string) {
	const answers: Record<string, string> = {};
	for (const line of text.trim().split("\n")) {
		const message: unknown = JSON.parse(line);
		const id = Predicate.hasProperty(message, "requestId") ? Number(message.requestId) : 0;
		answers[tags[id - 1] ?? "the batch"] = answerOfMessage(message);
	}
	return answers;
}

export function adminVerbs(state: HostState, tell: (line: string) => void) {
	return {
		adminRpc: (tags: readonly string[], caller: AdminCaller) => {
			tell(`the ${caller} calls ${tags.join(", ")} in one HTTP batch`);
			return io(async () => {
				const response = await fetch(`${state.url}/rpc`, {
					body: rpcBody(tags),
					headers: { authorization: token(caller), "content-type": "application/ndjson" },
					method: "POST",
				});
				state.response = {
					answers: answersOf(tags, await response.text()),
					cacheControl: response.headers.get("cache-control"),
					status: response.status,
				};
				return state.response;
			});
		},
		memberLosesAdmin: () => {
			tell("the member's role changes from admin to user while the session stays signed in");
			return Effect.sync(() => {
				state.adminSession.role = "user";
			});
		},
		openAdminStream: () => {
			tell("the member opens the admin RPC stream and reads its first chunk");
			return io(async () => {
				const response = await fetch(`${state.url}/rpc`, {
					body: rpcBody(["adminStream"]),
					headers: { authorization: "member", "content-type": "application/ndjson" },
					method: "POST",
				});
				if (response.body === null) {
					throw new Error("The admin RPC stream has no response body");
				}
				const reader = response.body.getReader();
				try {
					const chunk = await reader.read();
					return {
						cacheControl: response.headers.get("cache-control"),
						firstChunk: chunk.done ? "ended" : answerOfMessage(JSON.parse(new TextDecoder().decode(chunk.value))),
						status: response.status,
					};
				} finally {
					await reader.cancel();
				}
			});
		},
		rawRpc: (body: string, contentType: string) => {
			tell(`an anonymous ${contentType} post of ${body.length} bytes reaches /rpc`);
			return io(async () => {
				const response = await fetch(`${state.url}/rpc`, { body, headers: { "content-type": contentType }, method: "POST" });
				await response.body?.cancel();
				state.response = { cacheControl: response.headers.get("cache-control"), status: response.status };
			});
		},
		rpcAnswers: () => Effect.sync(() => state.response?.answers ?? "no RPC batch was sent"),
		visit: (path: string, caller: AdminCaller) => {
			tell(`the ${caller} opens ${path} in the browser`);
			return io(async () => {
				const response = await fetch(`${state.url}${path}`, { headers: { accept: "text/html", authorization: token(caller) } });
				return { body: await response.text(), cacheControl: response.headers.get("cache-control"), status: response.status };
			});
		},
	};
}

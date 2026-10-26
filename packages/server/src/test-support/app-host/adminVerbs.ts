import { type HostState, io } from "./state.ts";

export function rpcBody(tags: readonly string[]) {
	return `${tags.map((tag, index) => JSON.stringify({ _tag: "Request", headers: [], id: String(index + 1), payload: null, tag })).join("\n")}\n`;
}

export function adminVerbs(state: HostState, tell: (line: string) => void) {
	return {
		adminRpc: (tags: readonly string[], token: string) => {
			tell(`call ${tags.join(", ")} over HTTP as ${token || "anonymous"}`);
			return io(async () => {
				const response = await fetch(`${state.url}/rpc`, {
					body: rpcBody(tags),
					headers: { authorization: token, "content-type": "application/ndjson" },
					method: "POST",
				});
				return {
					cacheControl: response.headers.get("cache-control"),
					messages: (await response.text())
						.trim()
						.split("\n")
						.map((line: string) => JSON.parse(line)),
					status: response.status,
				};
			});
		},
		openAdminStream: (token: string) => {
			tell("open the admin RPC stream and read its first chunk");
			return io(async () => {
				const response = await fetch(`${state.url}/rpc`, {
					body: rpcBody(["adminStream"]),
					headers: { authorization: token, "content-type": "application/ndjson" },
					method: "POST",
				});
				if (response.body === null) {
					throw new Error("The admin RPC stream has no response body");
				}
				const reader = response.body.getReader();
				try {
					const chunk = await reader.read();
					return {
						body: new TextDecoder().decode(chunk.value),
						cacheControl: response.headers.get("cache-control"),
						done: chunk.done,
						status: response.status,
					};
				} finally {
					await reader.cancel();
				}
			});
		},
		setAdminRole: (role: string) => {
			tell(`change the session's role to ${role}`);
			state.adminSession.role = role;
		},
	};
}

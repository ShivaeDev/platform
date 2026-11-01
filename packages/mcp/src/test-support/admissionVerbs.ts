import { Effect } from "effect";
import type { Engine } from "./host.ts";

const listToolsBody = JSON.stringify({
	id: 1,
	jsonrpc: "2.0",
	method: "tools/list",
	params: {
		_meta: {
			"io.modelcontextprotocol/clientCapabilities": {},
			"io.modelcontextprotocol/protocolVersion": "2026-07-28",
		},
	},
});

export function admissionVerbs(engine: Engine, tell: (line: string) => void) {
	return {
		admissionUnavailable: () =>
			Effect.sync(() => {
				tell("The admission service becomes unavailable");
				engine.admission.unavailable = true;
			}),
		changesAdmission: (name: string, admitted: boolean) =>
			Effect.sync(() => {
				tell(`The admission rule ${admitted ? "admits" : "denies"} ${name}`);
				if (admitted) {
					engine.admission.denied.delete(name);
				} else {
					engine.admission.denied.add(name);
				}
			}),
		requestsMcp: (name: string, method: string) =>
			Effect.promise(async () => {
				tell(`${name} sends ${method} to the MCP endpoint`);
				const response = await fetch(`${engine.baseUrl}/mcp`, {
					...(method === "POST" ? { body: listToolsBody } : {}),
					headers: {
						accept: "application/json, text/event-stream",
						authorization: `Bearer ${engine.tokens.get(name)}`,
						"content-type": "application/json",
						"mcp-method": "tools/list",
						"mcp-protocol-version": "2026-07-28",
					},
					method,
				});
				await response.text();
				return { challenge: response.headers.has("www-authenticate"), status: response.status };
			}),
	};
}

import { Deferred, Effect } from "effect";
import { type Engine, person } from "./host.ts";

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
	function request(name: string, method: string) {
		return Effect.promise(async (signal) => {
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
				signal,
			});
			await response.text();
			return { challenge: response.headers.has("www-authenticate"), status: response.status };
		});
	}

	return {
		admissionServiceFails: () =>
			Effect.sync(() => {
				tell("The admission service becomes unavailable");
				engine.admission.unavailable = true;
			}),
		browserSession: (name: string) =>
			Effect.promise(async (signal) => {
				tell(`${name} reads the browser session over HTTP`);
				const response = await fetch(`${engine.baseUrl}/api/auth/get-session`, {
					headers: { cookie: person(engine, name).cookie },
					signal,
				});
				const session = await response.json();
				return session === null ? "signed out" : `signed in as ${session.user.name}`;
			}),
		deniesAdmission: (name: string) =>
			Effect.sync(() => {
				tell(`The admission rule denies ${name}`);
				engine.admission.denied.add(name);
			}),
		requestsMcp: (name: string, method: string) => request(name, method).pipe(Effect.timeout("5 seconds")),
		restoresAdmission: (name: string) =>
			Effect.sync(() => {
				tell(`The admission rule admits ${name} again`);
				engine.admission.denied.delete(name);
			}),
		startsMcpRequest: (name: string) =>
			Effect.gen(function* () {
				yield* request(name, "POST").pipe(Effect.forkScoped);
				yield* Deferred.await(engine.admission.entered);
			}),
	};
}

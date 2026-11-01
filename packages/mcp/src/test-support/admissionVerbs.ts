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
		admissionUnavailable: () =>
			Effect.sync(() => {
				tell("The admission service becomes unavailable");
				engine.admission.unavailable = true;
			}),
		browserSessionCount: (name: string) =>
			Effect.promise(async () => {
				const { adapter } = await engine.auth.$context;
				return adapter.count({ model: "session", where: [{ field: "userId", value: person(engine, name).id }] });
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
		requestsMcp: request,
		resumesAdmission: () => Deferred.succeed(engine.admission.resume, undefined),
		startsMcpRequest: (name: string) =>
			Effect.gen(function* () {
				yield* request(name, "POST").pipe(Effect.forkScoped);
				yield* Deferred.await(engine.admission.entered);
			}),
	};
}

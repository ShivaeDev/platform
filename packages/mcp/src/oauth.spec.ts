import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { mcp } from "#test/mcp.ts";

mcp.it(
	"a client connects through OAuth and acts as its consenting user",
	[],
	function* ({ mintSession, register, authorize, consent, exchange, request, baseUrl }) {
		const user = yield* mintSession("user");
		const registered = yield* register();
		expect(registered).toMatchObject({ status: HttpStatus.fromLiteral("Created") });
		const authorization = yield* authorize(registered.body.client_id, user.cookie);
		expect(authorization.status).toBe(HttpStatus.fromLiteral("OK"));
		const consentUrl = new URL(JSON.parse(authorization.body).url, baseUrl);
		expect(consentUrl.pathname).toBe("/consent");
		const granted = yield* consent(consentUrl.search.slice(1), user.cookie);
		expect(granted.status).toBe(HttpStatus.fromLiteral("OK"));
		const callback = new URL(granted.body.url);
		expect(callback.searchParams.get("state")).toBe("client-state");
		const token = yield* exchange(registered.body.client_id, callback.searchParams.get("code") ?? "");
		expect(token.status).toBe(HttpStatus.fromLiteral("OK"));
		const response = yield* request("tools/call", { arguments: {}, name: "whoami" }, token.body.access_token);
		expect(JSON.parse(response.body).result.content).toEqual([{ text: JSON.stringify(user.id), type: "text" }]);
	},
);

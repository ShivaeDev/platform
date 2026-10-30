import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { mcp } from "#test/mcp.ts";

mcp.it("a user discovers and calls only their tools", [], function* ({ mintSession, mintToken, request }) {
	const user = yield* mintSession("user");
	const token = yield* mintToken(user.id);
	const listed = yield* request("tools/list", {}, token);
	expect(listed.status).toBe(HttpStatus.fromLiteral("OK"));
	expect(JSON.parse(listed.body).result.tools.map((tool: { name: string }) => tool.name)).toEqual(["whoami"]);
	const called = yield* request("tools/call", { arguments: {}, name: "whoami" }, token);
	expect(JSON.parse(called.body).result.content).toEqual([{ text: JSON.stringify(user.id), type: "text" }]);
	const refused = yield* request("tools/call", { arguments: {}, name: "adminOnly" }, token);
	expect(JSON.parse(refused.body).error).toMatchObject({ code: -32_602 });
});

mcp.it("an admin discovers and calls admin tools as themselves", [], function* ({ mintSession, mintToken, request }) {
	const admin = yield* mintSession("admin");
	const token = yield* mintToken(admin.id);
	const listed = yield* request("tools/list", {}, token);
	expect(JSON.parse(listed.body).result.tools.map((tool: { name: string }) => tool.name)).toEqual(["whoami", "adminOnly", "refuse"]);
	const called = yield* request("tools/call", { arguments: {}, name: "adminOnly" }, token);
	expect(JSON.parse(called.body).result.content).toEqual([{ text: JSON.stringify(`admin:${admin.id}`), type: "text" }]);
	const user = yield* mintSession("user");
	const plain = yield* mintToken(user.id);
	const refused = yield* request("tools/call", { arguments: {}, name: "adminOnly" }, plain);
	expect(JSON.parse(refused.body).error).toMatchObject({ code: -32_602 });
});

mcp.it("an unauthenticated client receives OAuth discovery", [], function* ({ request, get, resource }) {
	const response = yield* request("tools/list");
	expect(response.status).toBe(HttpStatus.fromLiteral("Unauthorized"));
	expect(response.challenge).toBe(`Bearer resource_metadata="${resource.replace("/mcp", "/.well-known/oauth-protected-resource/mcp")}"`);
	const metadata = yield* get("/.well-known/oauth-protected-resource/mcp");
	expect(metadata).toMatchObject({ resource, "scopes_supported": ["mcp"] });
	const server = yield* get("/.well-known/oauth-authorization-server/api/auth");
	expect(server).toMatchObject({ "token_endpoint": `${new URL(resource).origin}/api/auth/oauth2/token` });
});

mcp.it("tokens for another resource or scope cannot call tools", [], function* ({ mintSession, mintToken, request }) {
	const user = yield* mintSession("user");
	const wrongAudience = yield* mintToken(user.id, "https://other.test/mcp");
	expect((yield* request("tools/list", {}, wrongAudience)).status).toBe(HttpStatus.fromLiteral("Unauthorized"));
	const wrongScope = yield* mintToken(user.id, undefined, "other");
	expect((yield* request("tools/list", {}, wrongScope)).status).toBe(HttpStatus.fromLiteral("Unauthorized"));
	expect((yield* request("tools/list", {}, "invalid-token")).status).toBe(HttpStatus.fromLiteral("Unauthorized"));
});

mcp.it("typed application failures reach the caller", [], function* ({ mintSession, mintToken, request }) {
	const admin = yield* mintSession("admin");
	const token = yield* mintToken(admin.id);
	const response = yield* request("tools/call", { arguments: {}, name: "refuse" }, token);
	expect(JSON.parse(response.body).result).toMatchObject({ content: [{ text: "Application refused", type: "text" }], isError: true });
});

mcp.it("a stored role change affects an already connected client", [], function* ({ mintSession, mintToken, request, changeRole }) {
	const admin = yield* mintSession("admin");
	const token = yield* mintToken(admin.id);
	const before = yield* request("tools/call", { arguments: {}, name: "adminOnly" }, token);
	expect(JSON.parse(before.body).result.content).toEqual([{ text: JSON.stringify(`admin:${admin.id}`), type: "text" }]);
	expect(yield* changeRole(admin.id, "user", admin.cookie)).toBe(HttpStatus.fromLiteral("OK"));
	const after = yield* request("tools/list", {}, token);
	expect(JSON.parse(after.body).result.tools.map((tool: { name: string }) => tool.name)).toEqual(["whoami"]);
	const refused = yield* request("tools/call", { arguments: {}, name: "adminOnly" }, token);
	expect(JSON.parse(refused.body).error).toMatchObject({ code: -32_602 });
});

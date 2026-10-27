import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { adminApplication, adminRole } from "#test/app-host/admin.ts";
import { configuration, host } from "#test/app-host/story.ts";

host.it(
	"a mixed batch of public success and admin rejection cannot be cached",
	[adminApplication, adminRole("admin")],
	function* ({ adminRpc, calls }) {
		const response = yield* adminRpc(["publicRead", "adminRead"], "");
		expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(response.cacheControl).toBe("private, no-store");
		expect(response.messages).toContainEqual({ _tag: "Exit", exit: { _tag: "Success", value: "public result" }, requestId: "1" });
		expect(response.messages).toContainEqual(
			expect.objectContaining({ _tag: "Exit", exit: expect.objectContaining({ _tag: "Failure" }), requestId: "2" }),
		);
		expect(calls()).toEqual([]);
	},
);

host.it("a typed handler failure cannot be cached", [adminApplication, adminRole("admin")], function* ({ adminRpc, calls }) {
	const response = yield* adminRpc(["adminReject"], "member");
	expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
	expect(response.cacheControl).toBe("private, no-store");
	expect(response.messages).toContainEqual(
		expect.objectContaining({
			exit: expect.objectContaining({
				_tag: "Failure",
				cause: expect.arrayContaining([expect.objectContaining({ _tag: "Fail", error: expect.objectContaining({ _tag: "Conflict" }) })]),
			}),
		}),
	);
	expect(calls()).toEqual(["adminReject"]);
});

host.it("an open native RPC stream cannot be cached", [adminApplication, adminRole("admin")], function* ({ openAdminStream, calls }) {
	const response = yield* openAdminStream("member");
	expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
	expect(response.cacheControl).toBe("private, no-store");
	expect(response.done).toBe(false);
	expect(response.body).toContain("member@example.test");
	expect(calls()).toEqual(["adminRead"]);
});

for (const { name, body, contentType, status } of [
	{ body: "{invalid json}\n", contentType: "application/ndjson", name: "malformed NDJSON", status: HttpStatus.fromLiteral("OK") },
	{ body: "{}\n", contentType: "application/json", name: "a transport guard rejection", status: HttpStatus.fromLiteral("Forbidden") },
	{ body: "x".repeat(257), contentType: "application/ndjson", name: "a body read failure", status: HttpStatus.fromLiteral("BadRequest") },
]) {
	host.it(`the response to ${name} cannot be cached`, [adminApplication, configuration({ maxBodySize: 256 })], function* ({ request, calls }) {
		const response = yield* request("/rpc", { body, headers: { "content-type": contentType }, method: "POST" });
		expect(response.status).toBe(status);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(calls()).toEqual([]);
	});
}

import { expect } from "vitest";
import { adminApplication, adminRole, unavailableAdminProvider } from "#test/app-host/admin.ts";
import { host } from "#test/app-host/story.ts";

for (const { name, traits, token, status, failure } of [
	{ failure: "Unauthorized", name: "signed-out", status: 401, token: "", traits: [] },
	{ failure: "Forbidden", name: "non-admin", status: 403, token: "member", traits: [adminRole("user")] },
	{ failure: "Forbidden", name: "owner without admin", status: 403, token: "member", traits: [adminRole("owner")] },
	{ failure: "AuthUnavailable", name: "provider-unavailable", status: 503, token: "member", traits: [unavailableAdminProvider] },
]) {
	host.it(
		`the ${name} caller cannot enter admin routes or RPCs and rejections cannot be cached`,
		[adminApplication, ...traits],
		function* ({ request, adminRpc, calls }) {
			for (const path of ["/admin", "/admin/", "/admin/tools.js", "/admin/jobs/detail"]) {
				const response = yield* request(path, { headers: { accept: "text/html", authorization: token } });
				expect(response.status).toBe(status);
				expect(response.headers.get("cache-control")).toBe("private, no-store");
				expect(response.body).toBe("");
			}
			const rpc = yield* adminRpc(["adminRead", "adminReject", "adminStream"], token);
			expect(rpc.status).toBe(200);
			expect(rpc.cacheControl).toBe("private, no-store");
			for (const id of ["1", "2", "3"]) {
				expect(rpc.messages).toContainEqual(
					expect.objectContaining({
						_tag: "Exit",
						exit: expect.objectContaining({
							_tag: "Failure",
							cause: expect.arrayContaining([expect.objectContaining({ _tag: "Fail", error: expect.objectContaining({ _tag: failure }) })]),
						}),
						requestId: id,
					}),
				);
			}
			expect(calls()).toEqual([]);
		},
	);
}

host.it(
	"an admin reaches the root, descendants and HTML fallback while the public SPA stays accessible",
	[adminApplication, adminRole("admin")],
	function* ({ request, adminRpc, calls }) {
		for (const [path, body] of [
			["/admin", "<main>Hosted app</main>"],
			["/admin/", "<main>Hosted app</main>"],
			["/admin/tools.js", "admin tools"],
			["/admin/jobs/detail", "<main>Hosted app</main>"],
		]) {
			const response = yield* request(path, { headers: { accept: "text/html", authorization: "member" } });
			expect(response.status).toBe(200);
			expect(response.body).toBe(body);
		}
		const rpc = yield* adminRpc(["adminRead"], "member");
		expect(rpc.cacheControl).toBe("private, no-store");
		expect(rpc.messages).toContainEqual(expect.objectContaining({ _tag: "Exit", exit: { _tag: "Success", value: "member@example.test" } }));
		expect(calls()).toEqual(["/admin", "/admin/", "/admin/tools.js", "/admin/jobs/detail", "adminRead"]);
		const publicPage = yield* request("/sign-in", { headers: { accept: "text/html" } });
		expect(publicPage.status).toBe(200);
		expect(publicPage.body).toBe("<main>Hosted app</main>");
	},
);

host.it(
	"revoking admin blocks the next route and RPC with the same session",
	[adminApplication, adminRole("admin")],
	function* ({ request, adminRpc, setAdminRole, calls, clearCalls }) {
		expect((yield* request("/admin", { headers: { accept: "text/html", authorization: "member" } })).status).toBe(200);
		expect((yield* adminRpc(["adminRead"], "member")).messages).toContainEqual(
			expect.objectContaining({ exit: { _tag: "Success", value: "member@example.test" } }),
		);
		setAdminRole("user");
		clearCalls();
		const route = yield* request("/admin/jobs/detail", { headers: { accept: "text/html", authorization: "member" } });
		expect(route.status).toBe(403);
		expect(route.headers.get("cache-control")).toBe("private, no-store");
		const rpc = yield* adminRpc(["adminRead"], "member");
		expect(rpc.cacheControl).toBe("private, no-store");
		expect(rpc.messages).toMatchObject([
			{ _tag: "Exit", exit: { _tag: "Failure", cause: [{ _tag: "Fail", error: { _tag: "Forbidden" } }] }, requestId: "1" },
		]);
		expect(calls()).toEqual([]);
	},
);

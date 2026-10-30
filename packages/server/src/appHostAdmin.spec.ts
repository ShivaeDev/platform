import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminApplication, adminRole, unavailableAdminProvider } from "#test/app-host/admin.ts";
import type { AdminCaller } from "#test/app-host/adminVerbs.ts";
import { host } from "#test/app-host/story.ts";

const adminPages = ["/admin", "/admin/", "/admin/tools.js", "/admin/jobs/detail"];

for (const { caller, name, traits, status, refusal } of [
	{ caller: "signed-out caller", name: "signed-out caller", refusal: "unauthorized", status: HttpStatus.fromLiteral("Unauthorized"), traits: [] },
	{
		caller: "member",
		name: "member with the user role",
		refusal: "forbidden",
		status: HttpStatus.fromLiteral("Forbidden"),
		traits: [adminRole("user")],
	},
	{
		caller: "member",
		name: "member with the owner role",
		refusal: "forbidden",
		status: HttpStatus.fromLiteral("Forbidden"),
		traits: [adminRole("owner")],
	},
	{
		caller: "member",
		name: "member during a session provider outage",
		refusal: "auth unavailable",
		status: HttpStatus.fromLiteral("ServiceUnavailable"),
		traits: [unavailableAdminProvider],
	},
] satisfies { caller: AdminCaller; name: string; refusal: string; status: number; traits: unknown[] }[]) {
	for (const path of adminPages) {
		host.it(`the ${name} receives an empty uncacheable ${status} from ${path}`, [adminApplication, ...traits], function* ({ visit }) {
			expect(yield* visit(path, caller)).toEqual({ body: "", cacheControl: "private, no-store", status });
		});
	}

	host.it(
		`the ${name}'s admin RPCs fail as ${refusal} in an uncacheable response before any handler runs`,
		[adminApplication, ...traits],
		function* ({ adminRpc, handledCalls, responseCacheControl, rpcAnswers }) {
			yield* adminRpc(["adminRead", "adminReject", "adminStream"], caller);

			yield* outcomes({
				"answers": [
					rpcAnswers(),
					{ adminRead: `failed with ${refusal}`, adminReject: `failed with ${refusal}`, adminStream: `failed with ${refusal}` },
				],
				"cache control": [responseCacheControl(), "private, no-store"],
				"handled calls": [handledCalls(), []],
			});
		},
	);
}

for (const [path, body] of [
	["/admin", "<main>Hosted app</main>"],
	["/admin/", "<main>Hosted app</main>"],
	["/admin/tools.js", "admin tools"],
	["/admin/jobs/detail", "<main>Hosted app</main>"],
] as const) {
	host.it(`an admin member receives ${body} from ${path}`, [adminApplication, adminRole("admin")], function* ({ visit }) {
		expect(yield* visit(path, "member")).toMatchObject({ body, status: HttpStatus.fromLiteral("OK") });
	});
}

host.it(
	"an admin member's admin RPC answers with their email in an uncacheable response",
	[adminApplication, adminRole("admin")],
	function* ({ adminRpc }) {
		expect(yield* adminRpc(["adminRead"], "member")).toEqual({
			answers: { adminRead: "member@example.test" },
			cacheControl: "private, no-store",
			status: HttpStatus.fromLiteral("OK"),
		});
	},
);

host.it("a signed-out caller still reaches the public SPA beside the admin area", [adminApplication], function* ({ visit }) {
	expect(yield* visit("/sign-in", "signed-out caller")).toMatchObject({ body: "<main>Hosted app</main>", status: HttpStatus.fromLiteral("OK") });
});

host.it(
	"losing admin refuses the member's next admin page uncacheably on the same session",
	[adminApplication, adminRole("admin")],
	function* ({ memberLosesAdmin, visit }) {
		expect(yield* visit("/admin/jobs/detail", "member")).toMatchObject({ status: HttpStatus.fromLiteral("OK") });

		yield* memberLosesAdmin();

		expect(yield* visit("/admin/jobs/detail", "member")).toEqual({
			body: "",
			cacheControl: "private, no-store",
			status: HttpStatus.fromLiteral("Forbidden"),
		});
	},
);

host.it(
	"losing admin refuses the member's next admin RPC uncacheably on the same session without running its handler",
	[adminApplication, adminRole("admin")],
	function* ({ adminRpc, handledCalls, memberLosesAdmin, responseCacheControl, rpcAnswers }) {
		yield* adminRpc(["adminRead"], "member");
		expect(yield* rpcAnswers()).toEqual({ adminRead: "member@example.test" });

		yield* memberLosesAdmin();

		yield* adminRpc(["adminRead"], "member");
		yield* outcomes({
			"answers": [rpcAnswers(), { adminRead: "failed with forbidden" }],
			"cache control": [responseCacheControl(), "private, no-store"],
			"handled calls": [handledCalls(), ["adminRead"]],
		});
	},
);

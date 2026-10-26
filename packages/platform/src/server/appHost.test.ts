import { Effect, Result } from "effect";
import { expect } from "vitest";
import { AuthUnavailable, Conflict, Unauthorized } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { failedMigration, migratedSql, postgresFeature } from "#test/app-host/database.ts";
import { assets } from "#test/app-host/options.ts";
import { environment, host, startupFails } from "#test/app-host/story.ts";

host.it("omitting services keeps migrated SQL available to RPC handlers", [migratedSql], function* ({ ping }) {
	expect(yield* ping()).toBe("pong");
});
host.it(
	"migrates before services, serves assets and guarded typed RPC, and releases its scope",
	[postgresFeature, assets, environment({ "TRUSTED_PROXY": "127.0.0.0/8,::1" })],
	function* ({ address, hostAddress, lifecycle, lookups, request, call, post, close }) {
		expect(address()).toMatchObject({ _tag: "InetAddressV4" });
		expect(hostAddress()).toBe("127.0.0.1");
		expect(lifecycle()).toEqual(["started"]);
		expect((yield* request()).body).toBe("<main>Hosted app</main>");
		expect((yield* request("/ready")).body).toBe("Ready");
		expect((yield* request("/sign-in", { headers: { accept: "text/html" } })).body).toBe("<main>Hosted app</main>");
		const success = yield* Effect.all([call("alice"), call("bob")], { concurrency: "unbounded" });
		expect(success.map((result) => Result.isSuccess(result) && result.success)).toEqual(["Hello, alice", "Hello, bob"]);
		for (const [token, reject, expected] of [
			["", false, Unauthorized],
			["alice", true, Conflict],
			["outage", false, AuthUnavailable],
		] as const) {
			const result = yield* call(token, reject);
			expect(Result.isFailure(result) && result.failure).toBeInstanceOf(expected);
		}
		const before = lookups().length;
		for (const headers of [{ origin: "http://elsewhere.test" }, { "content-type": "application/json" }, { host: "elsewhere.test" }]) {
			expect(yield* post(headers)).toBe(403);
		}
		expect(lookups()).toHaveLength(before);
		yield* close();
		expect(lifecycle()).toEqual(["started", "closed"]);
		expect(yield* Effect.result(request())).toMatchObject({ _tag: "Failure" });
	},
);
host.it("a migration failure prevents application services from starting", [failedMigration, startupFails], ({ lifecycle, bootFailure }) => {
	expect(bootFailure()).toBeDefined();
	expect(lifecycle()).toEqual([]);
});

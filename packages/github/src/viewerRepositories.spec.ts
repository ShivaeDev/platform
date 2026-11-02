import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { noInstallations, noRepositories, permissionLookupFails, unknownAccount, viewerRepositories } from "#test/viewerRepositories.ts";

for (const account of [11, "ALICE"]) {
	viewerRepositories.it(`account ${account} sees readable and administrable installed repositories across pages`, [], function* ({ readAccess }) {
		const access = yield* readAccess(account);

		expect(access).toMatchObject({
			administrable: [{ id: 45, installationId: 8, name: "engine", owner: { login: "other" } }],
			readable: [
				{ htmlUrl: "https://github.com/acme/widgets", id: 42, installationId: 7, name: "widgets", private: true },
				{ id: 44, installationId: 7, name: "public", private: false },
				{ id: 45, installationId: 8, name: "engine" },
			],
		});
	});
}

for (const permission of ["read", "triage", "write", "maintain", "admin", "none"]) {
	viewerRepositories.it(
		`${permission} permission grants the corresponding read and administration access`,
		[],
		function* ({ changePermission, readAccess }) {
			yield* changePermission("acme/widgets", permission);

			const access = yield* readAccess();

			expect(access).toMatchObject({
				administrable: permission === "admin" ? [{ name: "widgets" }, { name: "engine" }] : [{ name: "engine" }],
				readable: permission === "none" ? [{ name: "public" }, { name: "engine" }] : [{ name: "widgets" }, { name: "public" }, { name: "engine" }],
			});
		},
	);
}

viewerRepositories.it(
	"revoked read access and changed administration appear after 60 seconds despite repeated cache reads",
	[],
	function* ({ readAccess, changePermission, timePasses, requestsTo }) {
		expect(yield* readAccess()).toMatchObject({ readable: [{ name: "widgets" }, { name: "public" }, { name: "engine" }] });
		yield* changePermission("acme/widgets", "none");
		yield* changePermission("other/engine", "read");
		yield* timePasses(59);
		yield* outcomes([
			[
				"cached access",
				() => readAccess(),
				{ administrable: [{ name: "engine" }], readable: [{ name: "widgets" }, { name: "public" }, { name: "engine" }] },
			],
			["installation page requests", () => requestsTo("/app/installations"), [200, 200]],
		]);

		yield* timePasses(1);

		expect(yield* readAccess()).toMatchObject({ administrable: [], readable: [{ name: "public" }, { name: "engine" }] });
	},
);

viewerRepositories.it(
	"a repository removed from an installation disappears after 60 seconds",
	[],
	function* ({ readAccess, removeRepository, timePasses }) {
		expect(yield* readAccess()).toMatchObject({ administrable: [{ name: "engine" }] });
		yield* removeRepository(8, "engine");

		yield* timePasses(60);

		expect(yield* readAccess()).toMatchObject({ administrable: [], readable: [{ name: "widgets" }, { name: "public" }] });
	},
);

viewerRepositories.it("accounts have separate access results", [], function* ({ readAccess }) {
	expect(yield* readAccess("alice")).toMatchObject({ administrable: [{ name: "engine" }] });

	const access = yield* readAccess("bob");

	expect(access).toMatchObject({ administrable: [], readable: [{ name: "public" }] });
});

viewerRepositories.it("login casing shares the cached access result", [], function* ({ readAccess, requestsTo }) {
	yield* readAccess("alice");

	yield* readAccess("ALICE");

	expect(yield* requestsTo("/users/alice")).toEqual([200]);
});

viewerRepositories.it("an App with no installations returns no repository access", [noInstallations], function* ({ readAccess }) {
	const access = yield* readAccess();

	expect(access).toEqual({ administrable: [], readable: [] });
});

viewerRepositories.it("an unknown account fails the access lookup", [unknownAccount], function* ({ readAccess }) {
	const access = yield* readAccess();

	expect(access).toBe("not found");
});

viewerRepositories.it(
	"an installation-scoped App Layer reads account access across all installations with unscoped tokens",
	[],
	function* ({ readFromScopedApp, tokenScopes }) {
		const access = yield* readFromScopedApp();

		yield* outcomes([
			[
				"account access",
				() => Effect.succeed(access),
				{ administrable: [{ name: "engine" }], readable: [{ name: "widgets" }, { name: "public" }, { name: "engine" }] },
			],
			["installation token scopes", () => tokenScopes(), ["{}", "{}"]],
		]);
	},
);

viewerRepositories.it(
	"a failed permission lookup fails the result and the next request can recover immediately",
	[permissionLookupFails],
	function* ({ readAccess }) {
		expect(yield* readAccess()).toBe("HTTP 500");

		const access = yield* readAccess();

		expect(access).toMatchObject({ administrable: [{ name: "engine" }], readable: [{ name: "widgets" }, { name: "public" }, { name: "engine" }] });
	},
);

viewerRepositories.it(
	"the 101st account evicts the least recently used result and keeps a recently read account",
	[noRepositories],
	function* ({ readAccess, requestsTo }) {
		for (let account = 1; account <= 100; account += 1) {
			yield* readAccess(account);
		}
		yield* readAccess(1);

		yield* readAccess(101);

		yield* readAccess(1);
		yield* readAccess(2);
		yield* outcomes([
			["recently read account requests", () => requestsTo("/user/1"), [200]],
			["evicted account requests", () => requestsTo("/user/2"), [200, 200]],
		]);
	},
);

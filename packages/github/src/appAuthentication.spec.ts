import { expect } from "vitest";
import { APP_ID } from "#test/appFixture.ts";
import { appGithub } from "#test/appGithub.ts";

appGithub.it(
	"App credentials authenticate GET /app and every installation page with signed JWTs",
	[],
	function* ({ readApp, listInstallations, requests, jwts, exchanges }) {
		expect(yield* readApp()).toEqual({ appId: Number(APP_ID), slug: "widgets-app" });
		expect(yield* listInstallations()).toEqual([
			{ account: { login: "acme" }, installationId: 7 },
			{ account: { login: "other" }, installationId: 8 },
		]);
		expect(requests().map(({ path }) => path)).toEqual(["/app", "/app/installations", "/app/installations?page=2"]);
		expect(jwts().map(({ valid, claims }) => ({ appId: claims.iss, valid }))).toEqual(requests().map(() => ({ appId: APP_ID, valid: true })));
		expect(exchanges()).toHaveLength(0);
	},
);

appGithub.it("a metadata-only token requests repository ids for an access check", [], function* ({ readMetadata, exchanges }) {
	expect(yield* readMetadata()).toEqual({ id: 42, name: "widgets" });
	expect(JSON.parse(exchanges()[0]?.body.toString() ?? "")).toEqual({ permissions: { metadata: "read" }, "repository_ids": [42] });
	expect(exchanges()).toMatchObject([{ method: "POST", path: "/app/installations/7/access_tokens" }]);
});

appGithub.it("a token requests repository names and read permissions for scoped resource reads", [], function* ({ readScopedPull, exchanges }) {
	expect(yield* readScopedPull()).toEqual({ number: 1, title: "App read" });
	expect(JSON.parse(exchanges()[0]?.body.toString() ?? "")).toEqual({ permissions: { contents: "read" }, repositories: ["widgets"] });
});

appGithub.it("background reads use a full installation token when no scope is requested", [], function* ({ readPull, exchanges }) {
	expect(yield* readPull()).toEqual({ number: 1, title: "App read" });
	expect(JSON.parse(exchanges()[0]?.body.toString() || "{}")).toEqual({});
});

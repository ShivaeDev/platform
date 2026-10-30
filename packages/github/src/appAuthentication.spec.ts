import { expect } from "vitest";
import { appGithub } from "#test/appGithub.ts";

appGithub.it("the App reads /app, which GitHub accepts only with an App JWT", [], function* ({ readApp }) {
	expect(yield* readApp()).toEqual({ appId: 123_456, slug: "widgets-app" });
});

appGithub.it("the App lists the installations on both pages, each page accepted only with an App JWT", [], function* ({ listInstallations }) {
	expect(yield* listInstallations()).toEqual([
		{ account: { login: "acme" }, installationId: 7 },
		{ account: { login: "other" }, installationId: 8 },
	]);
});

for (const [scope, description, requested] of [
	["background", "a token with the installation's full access", {}],
	["access-check", "a metadata-read token for repository 42", { permissions: { metadata: "read" }, "repository_ids": [42] }],
	["contents", "a contents-read token for the widgets repository", { permissions: { contents: "read" }, repositories: ["widgets"] }],
] as const) {
	appGithub.it(`the ${scope} client asks GitHub for ${description}`, [], function* ({ exchangeRequested, readPullThrough }) {
		yield* readPullThrough(scope);

		expect(yield* exchangeRequested()).toEqual([requested]);
	});
}

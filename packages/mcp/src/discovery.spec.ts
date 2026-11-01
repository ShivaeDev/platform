import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { customIssuerMcp, rootIssuerMcp } from "#test/mcp.ts";

customIssuerMcp.it(
	"discovery follows the advertised custom issuer to its token endpoint over HTTP",
	[],
	function* ({ resourceMetadata, tokenEndpointOfItsAuthorizationServer }) {
		yield* outcomes([
			["advertised issuer", () => resourceMetadata(), { authorizationServers: ["/identity/tenant"], resource: "/mcp", scopes: ["mcp"] }],
			["discovered token endpoint", () => tokenEndpointOfItsAuthorizationServer(), "/api/auth/oauth2/token"],
		]);
	},
);

rootIssuerMcp.it("discovery follows a root issuer to its token endpoint over HTTP", [], function* ({ tokenEndpointOfItsAuthorizationServer }) {
	expect(yield* tokenEndpointOfItsAuthorizationServer()).toBe("/api/auth/oauth2/token");
});

import { expect } from "vitest";
import { authEdges, configurationRejected, metadataRejected } from "#test/authEdges.ts";

authEdges.it("a configuration rejection stays typed and keeps its cause", [configurationRejected], function* ({ configure, providerFailure }) {
	const result = yield* configure();

	expect(result.failure).toBe("auth unavailable");
	expect(result.cause).toBe(yield* providerFailure());
});

authEdges.it("a metadata rejection stays typed and keeps its cause", [metadataRejected], function* ({ loadMetadata, providerFailure }) {
	const result = yield* loadMetadata();

	expect(result.failure).toBe("auth unavailable");
	expect(result.cause).toBe(yield* providerFailure());
});

for (const [title, verb] of [
	["a grant lookup rejection", "lookupGrant"],
	["a client revocation rejection", "revokeClient"],
	["an all-clients revocation rejection", "revokeAllClients"],
] as const) {
	authEdges.it(`${title} stays typed and keeps its cause`, [], function* (verbs) {
		const result = yield* verbs[verb]();

		expect(result.failure).toBe("auth unavailable");
		expect(result.cause).toBe(yield* verbs.providerFailure());
	});
}

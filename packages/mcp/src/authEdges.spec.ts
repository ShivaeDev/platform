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

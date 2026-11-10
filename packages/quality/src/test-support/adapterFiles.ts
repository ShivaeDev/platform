import { readFileSync } from "node:fs";

// Copies of Platform adapters/ files as they stood when effect/adapter-bridges was introduced.
function copy(name: string): string {
	return readFileSync(new URL(`./fixtures/adapter-files/${name}.ts.txt`, import.meta.url), "utf8");
}

export const adapterFiles = {
	clientId: copy("clientId"),
	draftPersistence: copy("draftPersistence"),
	ignorePatterns: copy("ignorePatterns"),
	importCompilerDepartures: copy("importCompilerDepartures"),
	importCompilerService: copy("importCompilerService"),
	inspectionOperation: copy("inspectionOperation"),
	matchAdminRoute: copy("matchAdminRoute"),
	rawPayload: copy("rawPayload"),
	rethrowQueryDefect: copy("rethrowQueryDefect"),
	sessionRecheck: copy("sessionRecheck"),
	withPolicyContext: copy("withPolicyContext"),
};

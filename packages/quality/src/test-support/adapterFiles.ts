import { readFileSync } from "node:fs";

// Copies of Platform files as they stood when effect/adapter-bridges was introduced.
function copy(name: string): string {
	return readFileSync(new URL(`./fixtures/adapter-files/${name}.ts.txt`, import.meta.url), "utf8");
}

export const adapterFiles = {
	authOptions: copy("authOptions"),
	clientConnection: copy("clientConnection"),
	clientErrorReporter: copy("clientErrorReporter"),
	clientId: copy("clientId"),
	defineScript: copy("defineScript"),
	draftPersistence: copy("draftPersistence"),
	ignorePatterns: copy("ignorePatterns"),
	importCompilerDepartures: copy("importCompilerDepartures"),
	importCompilerService: copy("importCompilerService"),
	inspectionOperation: copy("inspectionOperation"),
	matchAdminRoute: copy("matchAdminRoute"),
	numberInput: copy("numberInput"),
	rawPayload: copy("rawPayload"),
	rethrowQueryDefect: copy("rethrowQueryDefect"),
	screenDialogs: copy("screenDialogs"),
	sessionRecheck: copy("sessionRecheck"),
	traceDiagnostics: copy("traceDiagnostics"),
	withPolicyContext: copy("withPolicyContext"),
};

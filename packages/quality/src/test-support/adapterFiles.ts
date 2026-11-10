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
	discordGateway: copy("discordGateway"),
	draftPersistence: copy("draftPersistence"),
	ignorePatterns: copy("ignorePatterns"),
	importCompilerDepartures: copy("importCompilerDepartures"),
	importCompilerService: copy("importCompilerService"),
	inspectionDeferrals: copy("inspectionDeferrals"),
	inspectionOperation: copy("inspectionOperation"),
	makeOpencodeServer: copy("makeOpencodeServer"),
	matchAdminRoute: copy("matchAdminRoute"),
	numberInput: copy("numberInput"),
	openLiveHints: copy("openLiveHints"),
	rawPayload: copy("rawPayload"),
	rethrowQueryDefect: copy("rethrowQueryDefect"),
	screenDialogs: copy("screenDialogs"),
	sessionRecheck: copy("sessionRecheck"),
	traceDiagnostics: copy("traceDiagnostics"),
	withPolicyContext: copy("withPolicyContext"),
};

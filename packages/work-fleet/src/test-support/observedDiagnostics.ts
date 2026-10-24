import { configureHostDiagnostics } from "#test/hostDiagnostics.ts";
import { host } from "#test/hostStory.ts";

export const observedDiagnostics = host.trait("configuration", "the daemon observes Codex and GitHub diagnostic sources", configureHostDiagnostics);

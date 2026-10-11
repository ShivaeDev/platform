import { Effect } from "effect";
import { codexLimits } from "@shivaedev/work-board/diagnostics/codexLimits.ts";
import { DiagnosticsContract } from "@shivaedev/work-board/diagnostics/daemonContract.ts";
import { githubLimits } from "@shivaedev/work-board/diagnostics/githubLimits.ts";
import { DiagnosticsSources, diagnostics } from "@shivaedev/work-board/diagnostics/source.ts";
import { HealthSnapshot } from "#engine/health.ts";

export const daemonDiagnostics = Effect.gen(function* () {
	const provided = yield* Effect.serviceOption(DiagnosticsSources);
	const sources = {
		codex: provided._tag === "Some" ? provided.value.codex : codexLimits(),
		fleet: yield* HealthSnapshot,
		github: provided._tag === "Some" ? provided.value.github : githubLimits(),
	};
	const read = yield* diagnostics(sources);
	return DiagnosticsContract.toLayer(Effect.succeed(DiagnosticsContract.of({ "daemon.diagnostics": () => read })));
});

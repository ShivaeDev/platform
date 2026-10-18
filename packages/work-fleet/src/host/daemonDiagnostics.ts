import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/integration/diagnostics.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { HealthSnapshot } from "#engine/health.ts";
import { fleetItems } from "#host/fleetItems.ts";

const { codexLimits, DiagnosticsContract, DiagnosticsSources, diagnostics, githubLimits } = diagnosticsApi;

export const daemonDiagnostics = Effect.gen(function* () {
	const provided = yield* Effect.serviceOption(DiagnosticsSources);
	const fleet = yield* HealthSnapshot;
	const sources = {
		codex: provided._tag === "Some" ? provided.value.codex : codexLimits(),
		fleet,
		github: githubLimits(fleet),
	};
	const read = yield* diagnostics(sources);
	const items = yield* fleetItems;
	return DiagnosticsContract.toLayer(
		Effect.succeed(
			DiagnosticsContract.of({
				"daemon.diagnostics": () => read,
				"daemon.fleetItems": () => items.pipe(Effect.mapError((error) => new ServiceUnavailable({ message: failureMessage(error) }))),
			}),
		),
	);
});

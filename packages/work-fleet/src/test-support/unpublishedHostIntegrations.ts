import { Effect, Layer } from "effect";
import type { FleetHost } from "#host/config.ts";
import { hostIntegrations } from "#host/integrations.ts";
import { FleetIntegrations } from "#policy.ts";

export function unpublishedHostIntegrations(host: FleetHost) {
	return Layer.effect(FleetIntegrations)(
		Effect.map(FleetIntegrations, (integrations) =>
			FleetIntegrations.of({
				...integrations,
				...(host.worker === undefined
					? {}
					: {
							publication: (work) => Effect.succeed({ branch: `${host.worker?.branchPrefix}${work.workId}`, remoteBranch: false }),
						}),
			}),
		),
	).pipe(Layer.provide(hostIntegrations(host)));
}

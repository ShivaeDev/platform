import { Context, Effect, Layer, Ref } from "effect";
import { Health, type HealthState } from "#engine/health.ts";
import { providerHealth } from "#host/providerHealth.ts";
import { codexQuota } from "#host/quota.ts";
import { SessionTransport } from "#session/service.ts";
import { capacityTransport } from "#test/capacityTransport.ts";

export function hostPolicyVerbs(tell: (line: string) => void) {
	let now = 1000;
	let limits: unknown = { ordinaryUsageAllowed: true, primary: { usedPercent: 12 } };
	let reads = 0;
	const refresh = codexQuota(
		() => now,
		Effect.sync(() => {
			reads += 1;
			return limits;
		}),
	);
	return {
		healthTransport: (explicit: boolean, terminal = false) =>
			Effect.gen(function* () {
				tell("observe provider capacity failures through the host health layer");
				const state = yield* Ref.make<HealthState>({ lastCapacityRejection: null, lastSchedulerPass: null });
				const base = capacityTransport(explicit);
				const transport = terminal ? terminalCapacityTransport(base) : base;
				const context = yield* Layer.build(
					providerHealth.pipe(Layer.provide(Layer.merge(Layer.succeed(SessionTransport)(transport), Layer.succeed(Health)(state)))),
				);
				return { health: () => Ref.get(state), transport: Context.get(context, SessionTransport) };
			}),
		quota: () => {
			tell("refresh the host quota");
			return refresh();
		},
		quotaObservation: (at: number, value: unknown) => {
			tell(`Codex reports usage at ${at}`);
			now = at;
			limits = value;
		},
		quotaReads: () => reads,
	};
}

function terminalCapacityTransport(base: typeof SessionTransport.Service): typeof SessionTransport.Service {
	return {
		...base,
		observe: (receipt) =>
			Effect.succeed({
				capacity: "serverOverloaded",
				error: "Private upstream text",
				execution: "failed",
				output: "",
				provisioning: "ready",
				receipt,
			}),
	};
}

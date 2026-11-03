import { Effect } from "effect";
import { expectTypeOf } from "vitest";
import { requireFeatures } from "#agent.ts";
import type { Agent, Backend, FeatureImplementations } from "#backend.ts";
import type { UnsupportedCapability } from "#failures.ts";

const selected = requireFeatures(["steering", "transcript"]);
expectTypeOf(selected).toEqualTypeOf<Effect.Effect<Agent<"steering" | "transcript">, UnsupportedCapability, Backend>>();

Effect.gen(function* () {
	const agent = yield* selected;
	expectTypeOf(agent.steering).toEqualTypeOf<FeatureImplementations["steering"]>();
	expectTypeOf(agent.transcript).toEqualTypeOf<FeatureImplementations["transcript"]>();
	// @ts-expect-error Queueing is not an alternative to steering.
	void agent.queuedInput.queue;
	// @ts-expect-error Sessions must be required explicitly.
	void agent.sessions.resume;
	const basic = yield* requireFeatures([]);
	// @ts-expect-error An unsupported transcript read is not an empty transcript.
	void basic.transcript.read;
});

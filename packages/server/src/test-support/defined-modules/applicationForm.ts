import { Effect } from "effect";
import { otlpReceiver } from "@shivaedev/test-story/server/otlpReceiver.ts";
import { definedModulesHost } from "#test/defined-modules/story.ts";

export const builtInApplicationEffect = definedModulesHost.trait(
	"configured",
	"the host is built in the application form, whose application Effect builds the modules' services with Layer.build and returns them already built",
	(state) => {
		state.host = "application";
	},
);

export const collector = definedModulesHost.trait("configured", "the host exports each span to a loopback OTLP collector as it ends", (state) =>
	Effect.gen(function* () {
		const receiver = yield* otlpReceiver();
		state.collector = {
			untilSpan: (name) => receiver.untilSpan((span) => span.name === name, { name: `${name} span reaches the collector` }),
		};
		Object.assign(state.env, { "OTEL_BSP_MAX_EXPORT_BATCH_SIZE": "1", "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url });
	}),
);

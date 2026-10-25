import { Effect } from "effect";
import { makeEffectIt } from "#makeEffectIt.ts";
import { ServerUrl } from "./ServerUrl.ts";

const { effectApp } = makeEffectIt({ clock: "live", layer: ServerUrl.layer, makeHarness: () => Effect.void });

for (const name of ["first", "second"]) {
	effectApp(`uses the shared service in the ${name} test`, function* () {
		const url = yield* ServerUrl;
		yield* Effect.promise(async () => (await fetch(url)).text());
	});
}

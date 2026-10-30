import { Effect } from "effect";
import { conditionalKit } from "./conditionalKit.ts";

const { given, kit } = conditionalKit(true);

function* body({ recordsBody }: { readonly recordsBody: () => Effect.Effect<void> }) {
	yield* recordsBody();
}

kit.it("plain", given, body);
kit.it.fails("fails", given, function* ({ recordsBody }) {
	yield* recordsBody();
	yield* Effect.fail("the story fails on purpose");
});
kit.it.skip("skip", given, body);
kit.it.runIf(true)("runIf true", given, body);
kit.it.runIf(false)("runIf false", given, body);
kit.it.skipIf(false)("skipIf false", given, body);
kit.it.skipIf(true)("skipIf true", given, body);

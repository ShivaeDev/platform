import type { Effect } from "effect";
import { conditionalKit } from "./conditionalKit.ts";

const { given, kit } = conditionalKit(false);
const focused = kit.it.only;

function* body({ recordsBody }: { readonly recordsBody: () => Effect.Effect<void> }) {
	yield* recordsBody();
}

kit.it("plain", given, body);
kit.it.fails("fails", given, body);
focused("only", given, body);
kit.it.skip("skip", given, body);
kit.it.runIf(true)("runIf true", given, body);
kit.it.runIf(false)("runIf false", given, body);
kit.it.skipIf(false)("skipIf false", given, body);
kit.it.skipIf(true)("skipIf true", given, body);

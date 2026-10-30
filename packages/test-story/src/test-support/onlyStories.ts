import type { Effect } from "effect";
import { conditionalKit } from "./conditionalKit.ts";

const { given, kit } = conditionalKit(true);
const focused = kit.it.only;

function* body({ recordsBody }: { readonly recordsBody: () => Effect.Effect<void> }) {
	yield* recordsBody();
}

focused("focused", given, body);
kit.it("plain", given, body);

import { Effect } from "effect";
import { FormPrimitivesScreen } from "#test-support/FormPrimitivesScreen.tsx";
import { acquireScreen } from "#test-support/screenState.ts";
import { screens } from "#test-support/screens.ts";

export const formPrimitives = screens.trait("screen", "the stock form primitives are rendered", function* (engine) {
	const view = yield* acquireScreen(engine);
	yield* Effect.promise(() => view.render(<FormPrimitivesScreen />));
});

import { Effect } from "effect";
import { acquireScreen } from "#test-support/screenState.ts";
import { FormPrimitivesScreen } from "./FormPrimitivesScreen.tsx";
import { screens } from "./screens.ts";

export const formPrimitives = screens.trait("screen", "the stock form primitives are rendered", function* (engine) {
	const view = yield* acquireScreen(engine);
	yield* Effect.promise(() => view.render(<FormPrimitivesScreen />));
});

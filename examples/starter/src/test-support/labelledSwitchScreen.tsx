import { Effect } from "effect";
import { SwitchScreen } from "./SwitchScreen.tsx";
import { acquireScreen } from "./screenState.ts";
import { screens } from "./screens.ts";

export function labelledSwitchScreen(label: string, disabled = false) {
	return screens.trait("screen", `the ${label} switch is open${disabled ? " and disabled" : ""}`, function* (engine) {
		const view = yield* acquireScreen(engine);
		yield* Effect.promise(() => view.render(<SwitchScreen disabled={disabled} label={label} />));
	});
}

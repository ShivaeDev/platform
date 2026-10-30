import { Effect, Fiber } from "effect";
import type { DatabaseEngine } from "./databaseEngine.ts";

type Tell = (line: string) => void;

function controlOf(engine: DatabaseEngine) {
	const release = engine.release;
	if (release === undefined) {
		throw new Error("No database release control was set up");
	}
	return release;
}

export function releaseVerbs(engine: DatabaseEngine, tell: Tell) {
	let handingOver: Fiber.Fiber<void, unknown> | undefined;
	return {
		handOverRelease: () => {
			tell("another deployment asks for the database release");
			return Effect.map(Effect.forkScoped(Effect.suspend(() => controlOf(engine).setActive(false))), (fiber) => {
				handingOver = fiber;
			});
		},
		takeBackRelease: () => {
			tell("this deployment takes the database release back");
			return Effect.suspend(() => controlOf(engine).setActive(true));
		},
		untilHandedOver: () => {
			tell("wait until the release is handed over");
			return Effect.suspend(() =>
				handingOver === undefined ? Effect.die(new Error("No hand-over was asked for")) : Fiber.join(handingOver).pipe(Effect.timeout("20 seconds")),
			);
		},
	};
}

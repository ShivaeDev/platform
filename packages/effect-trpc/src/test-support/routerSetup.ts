import type { RouterEngine } from "./routerEngine.ts";

export function selectRouter(engine: RouterEngine, trait: string, run: NonNullable<RouterEngine["build"]>["run"]) {
	if (engine.build !== undefined) {
		throw new Error(`Router traits ${engine.build.trait} and ${trait} cannot be combined`);
	}
	engine.build = { run, trait };
}

export function selectMode(engine: RouterEngine, trait: string, value: NonNullable<RouterEngine["mode"]>["value"]) {
	if (engine.mode !== undefined) {
		throw new Error(`Mode traits ${engine.mode.trait} and ${trait} cannot be combined`);
	}
	engine.mode = { trait, value };
}

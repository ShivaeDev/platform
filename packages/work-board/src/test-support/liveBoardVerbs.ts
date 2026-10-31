import { distinctVerbs } from "./distinctVerbs.ts";
import { mountedVerbs } from "./liveMounted.ts";
import { liveReadVerbs } from "./liveReadVerbs.ts";
import { liveSocketVerbs } from "./liveSocketVerbs.ts";
import { liveWatchVerbs } from "./liveWatchVerbs.ts";
import type { BoardEngine } from "./storyEngine.ts";

export function liveBoardVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return distinctVerbs(liveSocketVerbs(engine, tell), mountedVerbs(engine, tell), liveReadVerbs(engine, tell), liveWatchVerbs(engine, tell));
}

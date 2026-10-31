import { distinctVerbs } from "./distinctVerbs.ts";
import { goalScreenVerbs } from "./goalScreenVerbs.ts";
import { liveSessionSignals } from "./liveSessionSignals.ts";
import { nowScreenVerbs } from "./nowScreenVerbs.ts";
import { pageStateVerbs } from "./pageStateVerbs.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { statusChipVerbs } from "./statusChipVerbs.ts";
import { systemScreenVerbs } from "./systemScreenVerbs.ts";
import { timeScreenVerbs } from "./timeScreenVerbs.ts";
import { todayScreenVerbs } from "./todayScreenVerbs.ts";
import { workTableVerbs } from "./workTableVerbs.ts";

export function pagesScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	return distinctVerbs(
		goalScreenVerbs(engine, tell),
		pageStateVerbs(engine, tell),
		todayScreenVerbs(engine, tell),
		systemScreenVerbs(engine, tell),
		nowScreenVerbs(engine, tell),
		liveSessionSignals(engine, tell),
		workTableVerbs(engine, tell),
		timeScreenVerbs(engine, tell),
		statusChipVerbs(tell),
	);
}

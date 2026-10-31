import { distinctVerbs } from "./distinctVerbs.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { shellChromeVerbs } from "./shellChromeVerbs.ts";
import { shellFormVerbs } from "./shellFormVerbs.ts";
import { shellLibraryVerbs } from "./shellLibraryVerbs.ts";
import { shellPageVerbs } from "./shellPageVerbs.ts";
import { shellPhoneVerbs } from "./shellPhoneVerbs.ts";
import { shellReadingVerbs } from "./shellReadingVerbs.ts";
import { shellResultVerbs } from "./shellResultVerbs.ts";
import { shellSearchVerbs } from "./shellSearchVerbs.ts";
import { shellSessionVerbs } from "./shellSessionVerbs.ts";
import { shellSidebarVerbs } from "./shellSidebarVerbs.ts";
import { shellStartVerbs } from "./shellStartVerbs.ts";

export function shellScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	return distinctVerbs(
		shellChromeVerbs(engine, tell),
		shellFormVerbs(engine, tell),
		shellLibraryVerbs(engine, tell),
		shellPageVerbs(engine, tell),
		shellPhoneVerbs(engine, tell),
		shellReadingVerbs(engine, tell),
		shellResultVerbs(engine, tell),
		shellSearchVerbs(engine, tell),
		shellSessionVerbs(engine, tell),
		shellSidebarVerbs(engine, tell),
		shellStartVerbs(engine, tell),
	);
}

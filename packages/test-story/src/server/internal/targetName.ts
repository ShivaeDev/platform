import type { ScreenTarget } from "#server/screenDriver.ts";

export function targetName(target: ScreenTarget): string {
	return typeof target === "string"
		? target
		: `${target.role} named ${typeof target.name === "string" ? JSON.stringify(target.name) : String(target.name)}`;
}

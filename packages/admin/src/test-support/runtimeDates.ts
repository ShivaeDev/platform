import { execFileSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { DateDisplay } from "#client/timestampText.ts";

interface Runtime {
	own: { readonly locale: string; readonly timeZone: string } | undefined;
}

const PRINT_TIMESTAMP = fileURLToPath(new URL("printTimestamp.ts", import.meta.url));

export const runtimeDates = storyKit({
	create: () => Effect.succeed<Runtime>({ own: undefined }),
	name: "admin dates in a runtime",
	stages: ["runtime"],
	verbs: (engine, story) => ({
		written: (instant: string, dates: DateDisplay) =>
			Effect.sync(() => {
				if (engine.own === undefined) {
					throw new Error("Give the story a runtime first");
				}
				story.tell(`the runtime writes ${instant} given ${JSON.stringify(dates)}`);
				// Node reads its own locale once, when it starts, so only a new process can have another one.
				return execFileSync(process.execPath, ["--conditions=@shivaedev/source", PRINT_TIMESTAMP, instant, JSON.stringify(dates)], {
					encoding: "utf8",
					env: { "LC_ALL": `${engine.own.locale.replace("-", "_")}.UTF-8`, "TZ": engine.own.timeZone },
				});
			}),
	}),
});

export function runtimeDefaults(locale: string, timeZone: string) {
	return runtimeDates.trait("runtime", `a Node runtime starts with ${locale} as its own locale and ${timeZone} as its own time zone`, (engine) => {
		engine.own = { locale, timeZone };
	});
}

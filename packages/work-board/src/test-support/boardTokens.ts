import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { screenStory } from "./screenStory.ts";

export function boardTokens() {
	return screenStory.trait("workspace", "the page carries the Board's Amber Watch colour tokens", function* () {
		const stylesheet = readFileSync(join(import.meta.dirname, "../client/react/entry.css"), "utf8");
		const style = document.createElement("style");
		style.textContent = (stylesheet.match(/^(?::root|\.dark) \{[^}]*\}/gmu) ?? []).filter((block) => block.includes("--background:")).join("\n");
		document.head.append(style);
		yield* Effect.addFinalizer(() => Effect.sync(() => style.remove()));
	});
}

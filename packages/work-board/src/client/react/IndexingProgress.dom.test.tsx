import * as Atom from "effect/reactivity/Atom";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import type { Indexing } from "#rpc/Indexing.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen } from "#test/screenTraits.ts";
import { IndexingBar } from "./IndexingProgress.tsx";

expectNoReactWarnings();
const LABEL = '[data-indexing] [data-slot="progress-label"]';
const BAR = '[data-indexing][role="progressbar"]';
function indexing(progress: Indexing | undefined) {
	return componentScreen(<IndexingBar indexing={Atom.make(progress)} />);
}

screenStory.it("shows no progress once the server has finished indexing", [indexing(undefined)], ({ findElement }) => {
	expect(findElement("[data-indexing]")).toBeNull();
});

screenStory.it(
	"says it is reading the workspace before the file count is known",
	[indexing({ _tag: "Indexing", read: 0 })],
	({ readAttribute, readText }) => {
		expect(readText(LABEL)).toBe("Reading the workspace…");
		expect(readAttribute(BAR, "aria-valuenow")).toBeNull();
	},
);

screenStory.it(
	"counts the files read with thousands separators",
	[indexing({ _tag: "Indexing", read: 1240, total: 3936 })],
	({ readAttribute, readText }) => {
		expect(readText(LABEL)).toBe("Reading 1,240 of 3,936 files…");
		expect(Number(readAttribute(BAR, "aria-valuenow"))).toBeCloseTo((1240 / 3936) * 100);
	},
);

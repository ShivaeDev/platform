import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { QueryDocument } from "#test/QueryDocument.tsx";
import { DECISION_PATH, packetFiles, questionPath } from "#test/responsePacket.ts";
import { screenStory } from "#test/screenStory.ts";
import { boardScreen, routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

for (const path of [DECISION_PATH, questionPath]) {
	screenStory.it(`reads packet prose in the React shell at ${path}`, [routedScreen(packetFiles, `/${path}`)], function* ({ findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("article.doc p")).toContain("Read the evidence")));
		expect(readText("h1")).toBe("Choose a direction");
		expect(readText("article.doc")).toContain("Read the evidence before choosing.");
		expect(findElements("article.doc h2").map((heading) => heading.textContent)).toEqual(["Recommendation"]);
		expect(readText("article.doc")).not.toContain('"attention"');
	});
}

screenStory.it(
	"reads captured document prose through the native document query and React Markdown view",
	[boardScreen(packetFiles, (api) => <QueryDocument api={api} plain url={`/${questionPath}`} />)],
	function* ({ findElements, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("article.doc p")).toContain("Read the evidence")));
		expect(readText("h1")).toBe("Choose a direction");
		expect(readText("article.doc")).toContain("Read the evidence before choosing.");
		expect(findElements("article.doc h2").map((heading) => heading.textContent)).toEqual(["Recommendation"]);
		expect(readText("article.doc")).not.toContain('"attention"');
	},
);

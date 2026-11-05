import { expect } from "vitest";
import { card, hiddenBlock, inlineSentence, lineBreak, spacedBlocks, styledDisplays, surroundedBlock, textScreen } from "#test/textScreen.ts";

textScreen.it("reads a card's title, message and action as separate parts", [card], ({ text }) => {
	expect(text("article")).toBe("Today's news\nRead the latest stories.\nRead more");
});

textScreen.it("keeps an inline sentence with emphasis joined", [inlineSentence], ({ text }) => {
	expect(text("p")).toBe("Read today's news!");
});

textScreen.it("reads block boundaries through a scoped screen", [card], ({ within }) => {
	expect(within({ name: "News", role: "article" }).text()).toBe("Today's news\nRead the latest stories.\nRead more");
});

textScreen.it("separates blocks from surrounding inline text across the whole screen", [surroundedBlock], ({ text }) => {
	expect(text()).toBe("Before\nInside\nAfter");
});

textScreen.it("uses CSS display to distinguish block spans from inline paragraphs", [styledDisplays], ({ text }) => {
	expect(text()).toBe("First\nSecond\nJoinedTogether");
});

textScreen.it("separates text at an explicit line break", [lineBreak], ({ text }) => {
	expect(text("p")).toBe("First\nSecond");
});

textScreen.it("keeps hidden blocks out of an inline sentence", [hiddenBlock], ({ text }) => {
	expect(text("p")).toBe("Readmore");
});

textScreen.it("keeps existing whitespace between blocks without adding another separator", [spacedBlocks], ({ text }) => {
	expect(text()).toBe("First Second");
});

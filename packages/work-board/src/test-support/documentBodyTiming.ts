import { act } from "react";
import { vi } from "vitest";
import { screenStory } from "./screenStory.ts";

const body = vi.hoisted(() => {
	const waiting: (() => void)[] = [];
	return { held: false, waiting };
});

// Sections after the first wait for the browser between tasks; holding that wait keeps a long body part-way rendered.
vi.mock("#client/document/nextSection.ts", () => ({
	nextSection: () => (body.held ? new Promise<void>((resolve) => body.waiting.push(resolve)) : Promise.resolve()),
}));

function release() {
	body.held = false;
	for (const resume of body.waiting.splice(0)) {
		resume();
	}
}

export function heldDocumentBody() {
	return screenStory.trait("workspace", "the browser is busy before the rest of a long document renders", (engine) => {
		body.held = true;
		engine.cleanups.push(async () => release());
	});
}

export function finishDocumentBody() {
	return act(async () => release());
}

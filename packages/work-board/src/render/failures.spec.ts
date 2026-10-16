import { Effect, Layer, Schema } from "effect";
import { afterEach, expect, vi } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { renderMarkdown } from "#server/render/markdown.ts";
import { RenderFailed } from "./failed.ts";

vi.mock("shiki", async (importOriginal) => {
	const actual = await importOriginal<typeof import("shiki")>();
	return { ...actual, createHighlighter: vi.fn(actual.createHighlighter) };
});

import * as shiki from "shiki";

afterEach(() => vi.restoreAllMocks());

it.live("keeps highlighter startup failures typed for the host", function* () {
	const cause = new BadRequest({ message: "Unable to load themes" });
	vi.mocked(shiki.createHighlighter).mockRejectedValueOnce(cause);
	const failure = yield* Layer.build(Highlighter.layer).pipe(Effect.flip);
	expect(failure).toBeInstanceOf(RenderFailed);
	expect(Schema.is(RenderFailed)(failure)).toBe(true);
	expect(failure.cause).toBe(cause);
	expect(failure.message).toContain("restart Work Board");
});

it.live("keeps Markdown plugin failures typed for the rendering caller", function* () {
	const cause = new BadRequest({ message: "Invalid Markdown" });
	const failure = yield* renderMarkdown("# Note").pipe(
		Effect.provideService(Highlighter, {
			codeBlocks: () =>
				Effect.succeed(() => () => {
					throw cause;
				}),
		}),
		Effect.flip,
	);
	expect(failure).toBeInstanceOf(RenderFailed);
	expect(failure.cause).toBe(cause);
	expect(failure.message).toContain("Check the Markdown source and retry");
});

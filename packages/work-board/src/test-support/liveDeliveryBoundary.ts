import { vi } from "vitest";

vi.mock("effect", async (importOriginal) => {
	const actual = await importOriginal<typeof import("effect")>();
	return { ...actual, PubSub: { ...actual.PubSub } };
});

vi.mock("#server/search/watchIndex.ts", async (importOriginal) => {
	const actual = await importOriginal<typeof import("#server/search/watchIndex.ts")>();
	return { ...actual };
});

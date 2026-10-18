import { vi } from "vitest";

vi.mock("effect", async (importOriginal) => {
	const actual = await importOriginal<typeof import("effect")>();
	return { ...actual, PubSub: { ...actual.PubSub } };
});

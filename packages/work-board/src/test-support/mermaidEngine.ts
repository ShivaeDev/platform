import { vi } from "vitest";

const mermaidEngine = vi.hoisted(() => ({
	initialize: vi.fn(),
	render: vi.fn(async () => ({ svg: '<svg role="img"><text>Question → Response → History</text></svg>' })),
}));

vi.mock("mermaid", () => ({ default: mermaidEngine }));

export { mermaidEngine };

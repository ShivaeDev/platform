import { vi } from "vitest";

const mermaidEngine = vi.hoisted(() => ({
	initialize: vi.fn<(config: { themeVariables: { darkMode: boolean } }) => void>(),
	render: vi.fn(async (_id?: string, _source?: string) => ({ svg: '<svg role="img"><text>Question → Response → History</text></svg>' })),
}));

vi.mock("mermaid", () => ({ default: mermaidEngine }));

export { mermaidEngine };

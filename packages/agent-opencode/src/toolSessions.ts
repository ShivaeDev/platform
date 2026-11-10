import { Option } from "effect";
import type { ToolOutcome as DirectToolOutcome } from "#tools.ts";
export type ServedTool = (callId: string, args: unknown) => Promise<DirectToolOutcome>;
export interface ToolSessions {
	readonly forget: (session: string) => void;
	readonly names: readonly string[];
	readonly remember: (session: string, tools: ReadonlyMap<string, ServedTool>) => void;
	readonly served: (session: string) => Option.Option<ReadonlyMap<string, ServedTool>>;
}
export function makeToolSessions(names: readonly string[]): ToolSessions {
	const open = new Map<string, ReadonlyMap<string, ServedTool>>();
	return {
		forget: (session) => {
			open.delete(session);
		},
		names,
		remember: (session, tools) => {
			open.set(session, tools);
		},
		served: (session) => Option.fromNullishOr(open.get(session)),
	};
}

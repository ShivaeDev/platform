export interface WorkboardAsk {
	key: string;
	title: string;
	url: string | null;
}

export interface WorkboardGoalRef {
	id: string;
	title: string;
}

export interface WorkboardFlight {
	goal: WorkboardGoalRef | null;
	inStageMs: number | null;
	prUrl: string | null;
	stage: string;
	title: string;
	workId: string;
}

export interface WorkboardGoal {
	blocked: number;
	done: number;
	id: string;
	parked: number;
	running: number;
	scheduled: number;
	standing: boolean;
	title: string;
	total: number;
}

export interface WorkboardBlock<T> {
	items: T[];
	problem: string | null;
}

export type WorkboardBoard =
	| { kind: "loading" }
	| { cwd: string; kind: "none" }
	| { directory: string; kind: "down" }
	| { kind: "error"; message: string }
	| {
			asks: WorkboardBlock<WorkboardAsk>;
			flights: WorkboardBlock<WorkboardFlight>;
			goals: WorkboardBlock<WorkboardGoal>;
			kind: "ready";
	  };

declare module "claude-code" {
	interface PluginState {
		workboard: { board: WorkboardBoard; seenAsks: readonly string[] | null; updatedAt: number | null };
	}
	interface McpToolInputs {
		"mcp__workboard__board_overview": Record<never, never>;
		"mcp__workboard__item": { id: string };
		"mcp__workboard__needs_you": Record<never, never>;
	}
}

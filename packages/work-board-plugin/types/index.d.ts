export interface WorkboardAsk {
	key: string;
	title: string;
	url: string | null;
}

export interface WorkboardGoalRef {
	id: string;
	title: string;
}

export interface WorkboardAgent {
	id: string;
	role: string;
	state: string;
	turnMs: number | null;
}

export interface WorkboardFlight {
	agents: WorkboardAgent[];
	attentionOwner?: string | undefined;
	goal: WorkboardGoalRef | null;
	prUrl: string | null;
	stage: string;
	title: string;
	waitingReason?: string | undefined;
	workId: string;
}

export interface WorkboardGoal {
	achieved: boolean;
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

export interface WorkboardAreaTask {
	prUrl: string | null;
	stage: string;
	title: string;
	workId: string;
}

export interface WorkboardArea {
	area: string;
	holders: WorkboardAreaTask[];
	queue: WorkboardAreaTask[];
}

export type WorkboardBoard =
	| { kind: "loading" }
	| { cwd: string; kind: "none" }
	| { directory: string; kind: "down" }
	| { kind: "error"; message: string }
	| {
			areas: WorkboardBlock<WorkboardArea>;
			asks: WorkboardBlock<WorkboardAsk>;
			flights: WorkboardBlock<WorkboardFlight>;
			goals: WorkboardBlock<WorkboardGoal>;
			kind: "ready";
	  };

declare module "claude-code" {
	interface PluginState {
		workboard: {
			achievedOpen: boolean;
			board: Shaped<WorkboardBoard>;
			openArea: string | null;
			seenAsks: readonly string[] | null;
			updatedAt: number | null;
		};
	}
	interface McpToolInputs {
		"mcp__workboard__board_overview": Record<never, never>;
		"mcp__workboard__item": { id: string };
		"mcp__workboard__needs_you": Record<never, never>;
	}
}

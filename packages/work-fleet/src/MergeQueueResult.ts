export type MergeQueueResult =
	| "queued"
	| "pending"
	| "manual"
	| { readonly status: "failed"; readonly repairPrompt: string }
	| {
			readonly status: "held";
			readonly releasePr: string;
			readonly releaseProgress?: string | undefined;
			readonly releaseStuckReason?: string | undefined;
	  };

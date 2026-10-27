import type { Reply } from "./server.ts";

export interface QueuePull {
	autoMergeRequest: { enabledAt: string } | null;
	mergeQueueEntry: { id: string } | null;
	state: string;
	timelineItems: { nodes: { reason: string }[] };
}

export function queueReply(body: { query: string; variables: { number: number } }, entries: ReadonlyMap<number, QueuePull>): Reply {
	const itemType = /itemTypes:\s*\[(?<type>\w+)\]/u.exec(body.query)?.groups?.type;
	const fragment = /\.\.\. on (?<type>\w+)/u.exec(body.query)?.groups?.type;
	const errors: { message: string }[] = [];
	if (itemType !== undefined && itemType !== "REMOVED_FROM_MERGE_QUEUE_EVENT") {
		errors.push({
			message: `Argument 'itemTypes' on Field 'timelineItems' has an invalid value ([${itemType}]). Expected type '[PullRequestTimelineItemsItemType!]'.`,
		});
	}
	if (fragment !== undefined && fragment !== "RemovedFromMergeQueueEvent") {
		errors.push({ message: `No such type ${fragment}, so it can't be a fragment condition` });
	}
	if (errors.length > 0) {
		return { body: { errors } };
	}
	return { body: { data: { repository: { pullRequest: entries.get(body.variables.number) ?? null } } } };
}

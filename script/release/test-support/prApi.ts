import type { GitHubRequest } from "#release/gitHub.ts";
import type { ReleaseCiRun } from "#release/holdReason.ts";

interface PrState {
	body: string;
	created: number;
	open: boolean;
	queued: boolean;
	requests: { endpoint: string; method: string; body: Readonly<Record<string, unknown>> | undefined }[];
	run: ReleaseCiRun | undefined;
	title: string;
}

function snapshot(state: PrState, head: string) {
	const pull = {
		headRefOid: head,
		isCrossRepository: false,
		mergeQueueEntry: state.queued ? { id: "queued" } : null,
		number: 1,
		state: "OPEN",
	};
	return JSON.stringify({
		data: {
			repository: {
				pullRequests: {
					nodes: state.open ? [pull] : [],
				},
				ref: head === "" ? null : { target: { oid: head } },
			},
		},
	});
}

export function releasePrApi(branchHead: () => string) {
	const state: PrState = {
		body: "",
		created: 0,
		open: false,
		queued: false,
		requests: [],
		run: undefined,
		title: "",
	};
	const request: GitHubRequest = (endpoint, method, body) => {
		state.requests.push({ body, endpoint, method });
		if (endpoint === "graphql") {
			return snapshot(state, branchHead());
		}
		if (method === "GET") {
			return JSON.stringify({ "workflow_runs": state.run === undefined ? [] : [state.run] });
		}
		if (body === undefined) {
			throw new Error(`Missing body for ${endpoint}`);
		}
		if (body.state === "closed") {
			state.open = false;
		} else {
			if (method === "POST") {
				state.created += 1;
			}
			state.open = true;
			state.title = String(body.title);
			state.body = String(body.body);
		}
		return "{}";
	};
	return { request, state };
}

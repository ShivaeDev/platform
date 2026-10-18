import type { GitHubRequest } from "#release/gitHub.ts";

interface PrState {
	body: string;
	created: number;
	dispatched: Readonly<Record<string, unknown>>[];
	open: boolean;
	queued: boolean;
	requests: { endpoint: string; method: string; body: Readonly<Record<string, unknown>> | undefined }[];
	title: string;
}

function snapshot(state: PrState, head: string) {
	return JSON.stringify({
		data: {
			repository: {
				pullRequests: {
					nodes: state.open ? [{ isCrossRepository: false, mergeQueueEntry: state.queued ? { id: "queued" } : null, number: 1 }] : [],
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
		dispatched: [],
		open: false,
		queued: false,
		requests: [],
		title: "",
	};
	const request: GitHubRequest = (endpoint, method, body) => {
		state.requests.push({ body, endpoint, method });
		if (endpoint === "graphql") {
			return snapshot(state, branchHead());
		}
		if (body === undefined) {
			throw new Error(`Missing body for ${endpoint}`);
		}
		if (endpoint.endsWith("/dispatches")) {
			state.dispatched.push(body);
		} else if (body.state === "closed") {
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

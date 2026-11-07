import { Schema } from "effect";
import { type FakeHttpRequest, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
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
	return {
		data: {
			repository: {
				pullRequests: {
					nodes: state.open ? [pull] : [],
				},
				ref: head === "" ? null : { target: { oid: head } },
			},
		},
	};
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
	function savePull(method: string, body: Readonly<Record<string, unknown>>) {
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
		return { number: 1 };
	}
	function request(endpoint: string, method: string, body?: Readonly<Record<string, unknown>>) {
		state.requests.push({ body, endpoint, method });
		if (endpoint === "graphql") {
			return snapshot(state, branchHead());
		}
		if (endpoint.endsWith("/releases")) {
			return { id: 1 };
		}
		if (method === "GET") {
			return {
				"workflow_runs":
					state.run === undefined ? [] : [{ conclusion: state.run.conclusion, "head_sha": state.run.headSha, status: state.run.status }],
			};
		}
		if (body === undefined) {
			throw new Error(`Missing body for ${endpoint}`);
		}
		return savePull(method, body);
	}
	function reply(input: FakeHttpRequest) {
		const body =
			input.body.length === 0
				? undefined
				: Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)))(input.body.toString());
		return { body: request(input.path.slice(1), input.method, body) };
	}
	const serve = fakeHttpService({
		routes: {
			create: { method: "POST", path: "/repos/:path*", reply },
			edit: { method: "PATCH", path: "/repos/:path*", reply },
			graphql: { method: "POST", path: "/graphql", reply },
			runs: { path: "/repos/:path*", reply },
		},
	});
	return { serve, state };
}

import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import { responseContract } from "#rpc/responseContract.ts";
import { waitForResponse } from "./waitFor.ts";

export interface AgentOptions {
	readonly after?: string | undefined;
	readonly request: string;
	readonly revision?: string | undefined;
	readonly url: string;
}
function protocol(url: string) {
	return RpcClient.layerProtocolHttp({ url: `${url}/_board/rpc` }).pipe(Layer.provide([NodeHttpClient.layerNodeHttp, RpcSerialization.layerNdjson]));
}
function validate(url: string) {
	const parsed = new URL(url);
	if (
		parsed.protocol !== "http:"
		|| !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
		|| parsed.username
		|| parsed.password
		|| parsed.pathname !== "/"
		|| parsed.search
		|| parsed.hash
	) {
		throw new Error("Use a loopback Work Board URL, such as http://127.0.0.1:4747.");
	}
	return parsed.origin;
}
export function agentRequest(action: "question" | "response" | "wait", options: AgentOptions, diagnostic: (text: string) => void = () => undefined) {
	return Effect.scoped(
		Effect.gen(function* () {
			const client = yield* RpcClient.make(responseContract, { flatten: true });
			const [item, request, extra] = options.request.split("/");
			if (action === "question") {
				if (!(item && request) || extra) {
					return yield* Effect.fail(new Error("Use question <item>/<request>."));
				}
				return yield* client("work-board.question", { item, request });
			}
			let id = options.request;
			if (request !== undefined) {
				if (action !== "wait" || !item || !request || extra || !options.revision) {
					return yield* Effect.fail(new Error("Use wait <item>/<request> --revision <reviewed SHA-256>, or wait <registered-question-id>."));
				}
				const question = yield* client("work-board.registerQuestion", { item, request, revision: options.revision });
				id = question.id;
				diagnostic(`Registered ${id}; reattach with work-board wait ${id}. Deadline: ${new Date(question.question.deadline).toISOString()}`);
			}
			if (action === "response") {
				return yield* client("work-board.responses", { question: id });
			}
			return yield* waitForResponse(() => client("work-board.awaitResponse", { after: options.after, question: id }), diagnostic);
		}),
	).pipe(Effect.provide(protocol(validate(options.url))));
}

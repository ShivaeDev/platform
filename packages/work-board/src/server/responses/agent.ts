import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcSerialization from "effect/rpc/RpcSerialization";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { responseContract } from "#rpc/responseContract.ts";
import { agentUrl } from "./agentArguments.ts";
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
const requestFrom = Effect.fn("WorkBoard.requestFrom")(function* (
	action: "question" | "response" | "wait",
	options: AgentOptions,
	diagnostic: (text: string) => void,
) {
	const client = yield* RpcClient.make(responseContract, { flatten: true });
	const [item, request, extra] = options.request.split("/");
	if (action === "question") {
		if (!(item && request) || extra) {
			return yield* Effect.fail(new BadRequest({ message: "Use question <item>/<request>." }));
		}
		return yield* client("work-board.question", { item, request });
	}
	let id = options.request;
	if (request !== undefined) {
		if (action !== "wait" || !item || !request || extra || !options.revision) {
			return yield* Effect.fail(
				new BadRequest({ message: "Use wait <item>/<request> --revision <reviewed SHA-256>, or wait <registered-question-id>." }),
			);
		}
		const question = yield* client("work-board.registerQuestion", { item, request, revision: options.revision });
		id = question.id;
		diagnostic(`Registered ${id}; reattach with work-board wait ${id}. Deadline: ${new Date(question.question.deadline).toISOString()}`);
	}
	if (action === "response") {
		return yield* client("work-board.responses", { question: id });
	}
	return yield* waitForResponse(() => client("work-board.awaitResponse", { after: options.after, question: id }), diagnostic);
});

export const agentRequest = Effect.fn("WorkBoard.agentRequest")(function* (
	action: "question" | "response" | "wait",
	options: AgentOptions,
	diagnostic: (text: string) => void = () => undefined,
) {
	const url = yield* agentUrl(options.url);
	return yield* Effect.scoped(requestFrom(action, options, diagnostic)).pipe(Effect.provide(protocol(url)));
});

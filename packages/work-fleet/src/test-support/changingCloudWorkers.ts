import { Schema } from "effect";
import { codexServer } from "#test/codex.ts";
import {
	authFolder,
	cloudConfiguration,
	cloudThread,
	FUTURE_EXPIRY,
	SYNTHETIC_ENVIRONMENT,
	SYNTHETIC_WORKSPACE,
	syntheticToken,
} from "#test/codexCloud.ts";
import { task } from "#test/fleetHost.ts";
import { host } from "#test/hostStory.ts";

const Thread = Schema.Struct({ threadId: Schema.String });

function progressBackend() {
	let threads = 0;
	let progress = 0;
	return codexServer((request) => {
		switch (request.method) {
			case "thread/start":
				threads += 1;
				return { thread: { id: `thread-${threads}` } };
			case "thread/read":
				return cloudThread();
			case "turn/start":
				return { turn: { id: Schema.decodeUnknownSync(Thread)(request.params).threadId } };
			case "thread/turns/list":
				return { data: [{ id: Schema.decodeUnknownSync(Thread)(request.params).threadId, items: [], status: "inProgress" }], nextCursor: null };
			case "thread/items/list":
				progress += 1;
				return { data: [{ item: { id: `progress-${progress}`, status: "inProgress", type: "commandExecution" } }], nextCursor: null };
			default:
				return {};
		}
	});
}

export const changingCloudWorkers = host.trait(
	"configuration",
	"300 Board documents and four Cloud workers with changing progress",
	function* (engine) {
		const backend = yield* progressBackend();
		const auth = yield* authFolder(syntheticToken("document-reads", FUTURE_EXPIRY));
		for (let index = 0; index < 300; index += 1) {
			engine.files[`${index}.md`] = task(`item.${index}`, index < 4 ? "approved" : "draft");
		}
		engine.config = { ...engine.config, cloud: { cwd: SYNTHETIC_WORKSPACE, environmentId: SYNTHETIC_ENVIRONMENT }, provider: "cloud" };
		engine.provider = cloudConfiguration(backend.endpoint, auth);
		// Keep callback contexts alive so GC cannot hide an expired pass that still owns its reads.
		engine.workerContexts = [];
	},
);

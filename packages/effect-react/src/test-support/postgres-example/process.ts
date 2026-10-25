import process from "node:process";
import { Effect, Logger, Schema } from "effect";
import { Rejected } from "./contract.ts";
import { Configuration, Message, type Response } from "./processProtocol.ts";
import { startServer } from "./server.ts";
import { startWorker } from "./startWorker.ts";

function send(response: Response) {
	process.send?.(response);
}
const config = Schema.decodeUnknownSync(Schema.fromJsonString(Configuration))(process.argv[2]);
let reject = false;
const server =
	config.role === "server"
		? await startServer(config.databaseUrl, {
				...config,
				beforeCommit: Effect.suspend(() => {
					if (!reject) {
						return Effect.void;
					}
					reject = false;
					return Effect.fail(new Rejected());
				}),
				keepTables: true,
				logger: Logger.make((options) => {
					const log = Logger.formatStructured.log(options);
					send({ _tag: "Log", annotations: log.annotations, level: options.logLevel, message: options.message });
				}),
			})
		: undefined;
const worker = config.role === "worker" ? startWorker(config, () => send({ _tag: "Handled" })) : undefined;
await worker?.ready();
process.on("message", (input) => {
	const message = Schema.decodeUnknownSync(Message)(input);
	async function handle() {
		switch (message._tag) {
			case "Close":
				await server?.close();
				await worker?.close();
				process.disconnect();
				break;
			case "Reject":
				reject = true;
				send({ _tag: "Rejected" });
				break;
			case "Enqueue":
				await worker?.enqueue(message.order);
				send({ _tag: "Enqueued" });
		}
	}
	void handle().catch((error: unknown) => send({ _tag: "Failure", message: String(error) }));
});
send({ _tag: "Ready", url: server?.url ?? "" });

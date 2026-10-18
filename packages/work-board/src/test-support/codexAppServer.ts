import process from "node:process";
import { createInterface } from "node:readline";

const mode = process.argv[2];
const lines = createInterface({ input: process.stdin });
function send(value: unknown) {
	process.stdout.write(`${JSON.stringify(value)}\n`);
}
function accountReply(message: ReturnType<typeof JSON.parse>) {
	if (message.method !== "account/read" || message.params.refreshToken !== false) {
		process.exit(1);
	}
	send({ id: message.id, result: { account: mode === "missing" ? null : { type: mode === "api-key" ? "apiKey" : "chatgpt" } } });
}
function reply(message: ReturnType<typeof JSON.parse>) {
	switch (message.id) {
		case "initialize":
			send(mode === "initialize-error" ? { error: { message: "Initialize refused" }, id: message.id } : { id: message.id, result: {} });
			return;
		case "account":
			accountReply(message);
			return;
		case "limits":
			if (message.method !== "account/rateLimits/read") {
				process.exit(1);
			}
			send(
				mode === "refusal"
					? { error: { message: "Account forbidden" }, id: message.id }
					: { id: "approval", method: "item/commandExecution/requestApproval", params: {} },
			);
			return;
		case "approval":
			if (message.error?.code !== -32_601) {
				process.exit(1);
			}
			send({
				id: "limits",
				result: {
					rateLimits: {
						primary: { resetsAt: 1_800_000_000, usedPercent: 24, windowDurationMins: 300 },
						secondary: { resetsAt: 1_800_086_400, usedPercent: 63, windowDurationMins: 10_080 },
					},
				},
			});
	}
}
lines.on("line", (line) => {
	if (mode === "timeout") {
		return;
	}
	if (mode === "exit") {
		process.exit(0);
	}
	if (mode === "malformed") {
		process.stdout.write("not json\n");
		return;
	}
	reply(JSON.parse(line));
});

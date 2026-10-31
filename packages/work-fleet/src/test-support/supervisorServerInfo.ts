import { request } from "node:http";
import { Effect } from "effect";

function frames(body: string): readonly unknown[] {
	return body
		.trim()
		.split("\n")
		.map((line): unknown => JSON.parse(line));
}

function socketCall(socketPath: string) {
	return new Promise<readonly unknown[]>((resolve, reject) => {
		const outgoing = request(
			"http://localhost/_board/rpc",
			{
				headers: { "content-type": "application/ndjson" },
				method: "POST",
				socketPath,
			},
			(response) => {
				let body = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					body += chunk;
				});
				response.on("error", reject);
				response.on("end", () => {
					try {
						resolve(frames(body));
					} catch (error) {
						reject(error);
					}
				});
			},
		);
		outgoing.on("error", reject);
		outgoing.end(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag: "work-board.server" })}\n`);
	});
}

function served(frame: unknown) {
	if (typeof frame !== "object" || frame === null || !("exit" in frame)) {
		return undefined;
	}
	const { exit } = frame;
	return typeof exit === "object" && exit !== null && "value" in exit ? exit.value : undefined;
}

export function supervisorServerInfo(socketPath: string) {
	return Effect.tryPromise(() => socketCall(socketPath)).pipe(
		Effect.map((answers) => answers.map(served).find((value) => value !== undefined) ?? "no server info"),
	);
}

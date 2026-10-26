import { type Agent, request } from "node:http";

export function postBody(
	url: string,
	agent: Agent,
	chunks: readonly Uint8Array[],
	options: { contentLength?: number; finishAfterResponse?: boolean } = {},
) {
	const { contentLength, finishAfterResponse } = options;
	return new Promise<{ readonly status: number; readonly body: Buffer; readonly reusedSocket: boolean }>((resolve, reject) => {
		const outgoing = request(
			`${url}/body`,
			{ agent, headers: contentLength === undefined ? {} : { "content-length": contentLength }, method: "POST" },
			(response) => {
				const received: Buffer[] = [];
				response.on("data", (chunk: Buffer) => received.push(chunk));
				response.on("end", () => {
					if (finishAfterResponse) {
						outgoing.end("unread tail");
					}
					resolve({ body: Buffer.concat(received), reusedSocket: outgoing.reusedSocket, status: response.statusCode ?? 0 });
				});
			},
		);
		outgoing.on("error", reject);
		for (const chunk of chunks) {
			outgoing.write(chunk);
		}
		if ((chunks.length === 0 && contentLength !== undefined) || finishAfterResponse) {
			outgoing.flushHeaders();
		} else {
			outgoing.end();
		}
	});
}

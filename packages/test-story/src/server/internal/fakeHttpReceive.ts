import type { IncomingMessage, ServerResponse } from "node:http";
import type { FakeHttpRequest, FakeHttpRoute, FakeHttpServiceOptions } from "#fakeHttpService.ts";
import { fakeHttpAnswer } from "#internal/fakeHttpAnswer.ts";
import type { fakeHttpControls } from "#internal/fakeHttpControls.ts";
import { fakeHttpSend } from "#internal/fakeHttpSend.ts";

function match(route: FakeHttpRoute, method: string, pathname: string) {
	if ((route.method ?? "GET").toUpperCase() !== method) {
		return;
	}
	const pattern = route.path.split("/");
	const segments = pathname.split("/");
	if (pattern.length !== segments.length) {
		return;
	}
	const params: Record<string, string> = {};
	for (const [index, part] of pattern.entries()) {
		const segment = segments[index] ?? "";
		if (part.startsWith(":")) {
			params[part.slice(1)] = segment;
		} else if (part !== segment) {
			return;
		}
	}
	return params;
}

function decodeParams(params: Record<string, string>) {
	try {
		for (const [name, value] of Object.entries(params)) {
			params[name] = decodeURIComponent(value);
		}
		return true;
	} catch {
		return false;
	}
}

export async function fakeHttpReceive(
	incoming: IncomingMessage,
	response: ServerResponse,
	options: FakeHttpServiceOptions,
	requests: FakeHttpRequest[],
	controls: ReturnType<typeof fakeHttpControls>,
	tell: (line: string) => void,
) {
	try {
		const path = incoming.url ?? "/";
		const url = new URL(path, "http://127.0.0.1");
		const method = incoming.method ?? "GET";
		const found = Object.entries(options.routes).flatMap(([name, route]) => {
			const params = match(route, method, url.pathname);
			return params ? [{ name, params, route }] : [];
		})[0];
		const chunks: Buffer[] = [];
		for await (const chunk of incoming) {
			chunks.push(Buffer.from(chunk));
		}
		const params = found?.params ?? {};
		const request: FakeHttpRequest = {
			body: Buffer.concat(chunks),
			headers: incoming.headers,
			method,
			params,
			path,
			query: url.searchParams,
		};
		requests.push(request);
		tell(`fake HTTP received ${method} ${path}`);
		if (!decodeParams(params)) {
			tell(`fake HTTP rejected ${method} ${path} with 400`);
			await fakeHttpSend(response, { status: 400 });
			return;
		}
		if ((options.guard && !options.guard(request)) || (found?.route.guard && !found.route.guard(request))) {
			tell(`fake HTTP rejected ${method} ${path} with 401`);
			await fakeHttpSend(response, { status: 401 });
			return;
		}
		if (!found) {
			tell(`fake HTTP answered ${method} ${path} with 404`);
			await fakeHttpSend(response, { status: 404 });
			return;
		}
		await fakeHttpAnswer(found.name, found.route, request, response, controls, tell);
	} catch (error) {
		tell(`fake HTTP could not answer: ${String(error)}`);
		if (response.headersSent) {
			response.destroy();
		} else {
			await fakeHttpSend(response, { status: 500 });
		}
	}
}

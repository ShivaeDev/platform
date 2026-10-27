import type { IncomingMessage, ServerResponse } from "node:http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { FakeHttpRequestRecord, FakeHttpRoute, FakeHttpServiceOptions } from "#fakeHttpService.ts";
import { fakeHttpAnswer } from "#internal/fakeHttpAnswer.ts";
import type { fakeHttpControls } from "#internal/fakeHttpControls.ts";
import { fakeHttpSend } from "#internal/fakeHttpSend.ts";

function match(route: FakeHttpRoute, method: string, pathname: string) {
	if ((route.method ?? "GET").toUpperCase() !== method) {
		return;
	}
	const pattern = route.path.split("/");
	const segments = pathname.split("/");
	const rest = pattern.at(-1)?.startsWith(":") && pattern.at(-1)?.endsWith("*");
	if (rest ? segments.length < pattern.length : pattern.length !== segments.length) {
		return;
	}
	return pathParams(pattern, segments);
}

function pathParams(pattern: string[], segments: string[]) {
	const params: Record<string, string> = {};
	for (const [index, part] of pattern.entries()) {
		const segment = segments[index] ?? "";
		if (part.startsWith(":")) {
			if (part.endsWith("*")) {
				if (index !== pattern.length - 1 || !segment) {
					return;
				}
				params[part.slice(1, -1)] = segments.slice(index).join("/");
			} else {
				params[part.slice(1)] = segment;
			}
		} else if (part !== segment) {
			return;
		}
	}
	return params;
}

function decodeParams(params: Record<string, string>) {
	try {
		for (const [name, value] of Object.entries(params)) {
			params[name] = value.split("/").map(decodeURIComponent).join("/");
		}
		return true;
	} catch {
		return false;
	}
}

function requestStatus(response: ServerResponse) {
	if (response.writableFinished) {
		return response.statusCode;
	}
	return response.destroyed ? "unanswered" : "pending";
}

export async function fakeHttpReceive(
	incoming: IncomingMessage,
	response: ServerResponse,
	options: FakeHttpServiceOptions,
	requests: FakeHttpRequestRecord[],
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
		const request: FakeHttpRequestRecord = {
			body: Buffer.concat(chunks),
			headers: incoming.headers,
			method,
			params,
			path,
			query: url.searchParams,
			get status() {
				return requestStatus(response);
			},
		};
		requests.push(request);
		tell(`fake HTTP received ${method} ${path}`);
		if (!decodeParams(params)) {
			tell(`fake HTTP rejected ${method} ${path} with 400`);
			await fakeHttpSend(response, { status: HttpStatus.fromLiteral("BadRequest") });
			return;
		}
		if ((options.guard && !options.guard(request)) || (found?.route.guard && !found.route.guard(request))) {
			tell(`fake HTTP rejected ${method} ${path} with 401`);
			await fakeHttpSend(response, { status: HttpStatus.fromLiteral("Unauthorized") });
			return;
		}
		if (!found) {
			tell(`fake HTTP answered ${method} ${path} with 404`);
			await fakeHttpSend(response, { status: HttpStatus.fromLiteral("NotFound") });
			return;
		}
		await fakeHttpAnswer(found.name, found.route, request, response, controls, tell);
	} catch (error) {
		tell(`fake HTTP could not answer: ${String(error)}`);
		if (response.headersSent) {
			response.destroy();
		} else {
			await fakeHttpSend(response, { status: HttpStatus.fromLiteral("InternalServerError") });
		}
	}
}

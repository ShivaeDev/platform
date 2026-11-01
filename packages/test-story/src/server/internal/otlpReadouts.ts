import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { OtlpExport, OtlpSpan } from "#otlpReceiver.ts";

const parseJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));

function contains(value: unknown, secret: string): boolean {
	if (typeof value === "object" && value !== null) {
		return Object.entries(value).some(([key, item]) => key.includes(secret) || contains(item, secret));
	}
	return String(value).includes(secret);
}

export function exportsSecret(requests: readonly OtlpExport[], secret: string) {
	return requests.some(({ body, headers }) => {
		if (body.includes(Buffer.from(secret))) {
			return true;
		}
		if (headers["content-type"]?.split(";")[0]?.trim() === "application/json") {
			return Option.exists(parseJson(body.toString()), (value) => contains(value, secret));
		}
		return false;
	});
}

function text(attributes: OtlpSpan["attributes"], key: string) {
	return attributes.find((attribute) => attribute.key === key)?.value.stringValue;
}

export function queries(spans: readonly OtlpSpan[]) {
	return spans.flatMap((span) => {
		const query = text(span.attributes, "db.query.text") ?? text(span.attributes, "db.statement");
		return query === undefined ? [] : [query];
	});
}

export function errors(spans: readonly OtlpSpan[]) {
	return spans.flatMap((span) => {
		const exceptions = span.events
			.filter((event) => event.name === "exception")
			.map((event) => ({
				message: text(event.attributes, "exception.message") ?? span.status.message ?? span.name,
				operation: span.name,
				type: text(event.attributes, "exception.type"),
			}));
		return exceptions.length > 0 || span.status.code !== 2
			? exceptions
			: [{ message: span.status.message ?? span.name, operation: span.name, type: undefined }];
	});
}

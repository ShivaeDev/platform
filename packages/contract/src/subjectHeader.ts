import { Headers } from "effect/http";

const HEADER = "x-platform-subject";

export function subjectHeader(headers: Headers.Headers): string | undefined {
	return headers[HEADER];
}

export function withSubject(headers: Headers.Input | undefined, subject: string | undefined): Headers.Input | undefined {
	return subject === undefined ? headers : Headers.set(Headers.fromInput(headers), HEADER, subject);
}

// Effect keys a serialized query by its tag and this key alone, so a subject that the key leaves out would hydrate into another subject's query.
export function subjectSerializationKey(key: string | undefined, headers: Headers.Input | undefined): string | undefined {
	const subject = headers === undefined ? undefined : subjectHeader(Headers.fromInput(headers));
	return key === undefined || subject === undefined ? key : `${key}:subject:${subject}`;
}

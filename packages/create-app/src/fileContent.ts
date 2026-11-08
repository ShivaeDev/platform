// A leading byte order mark is file content, and generated apps stay byte-for-byte the same.
const decoder = new TextDecoder("utf-8", { "ignoreBOM": true });
const encoder = new TextEncoder();

export function textOf(content: Uint8Array) {
	return decoder.decode(content);
}

export function bytesOf(text: string) {
	return encoder.encode(text);
}

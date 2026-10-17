import { expect, it } from "vitest";
import { redactOtlpUrl } from "#redactOtlpUrl.ts";

it.each([
	["url.full", "https://example.test/path?one=secret&two=other", "https://example.test/path?one=<redacted>&two=<redacted>"],
	["http.url", "https://example.test/path?one=secret#fragment", "https://example.test/path?one=<redacted>#<redacted>"],
	["http.target", "/path?repeat=first&repeat=second", "/path?repeat=<redacted>&repeat=<redacted>"],
	["url.original", "relative?unknown=secret", "relative?unknown=<redacted>"],
	["request.uri", "//user:password@example.test/path?q=secret", "//<redacted>@example.test/path?q=<redacted>"],
	["url.full", "https://user@example.test/path#fragment", "https://<redacted>@example.test/path#<redacted>"],
	["url.query", "bare&empty=&a=one=two&&encoded%20name=%23secret", "bare=<redacted>&empty=<redacted>&a=<redacted>&&encoded%20name=<redacted>"],
	["url.query", "q=secret#fragment?other=secret", "q=<redacted>#<redacted>"],
	["url.query", "?q=secret", "?q=<redacted>"],
	["url.query", "", ""],
	["url.full", "/path?", "/path?"],
	["url.full", "/path#fragment?query=secret", "/path#<redacted>"],
	["url.fragment", "fragment", "<redacted>"],
	["url.username", "user", "<redacted>"],
	["url.userinfo", "user:password", "<redacted>"],
	["custom", "https://example.test/path?q=secret", "https://example.test/path?q=<redacted>"],
	[
		"http.request.header.referer",
		"https://example.test/callback?code='c1'&state=s1",
		"https://example.test/callback?code=<redacted>&state=<redacted>",
	],
	["custom", "failed GET /path?q=secret#fragment next", "failed GET /path?q=<redacted>#<redacted> next"],
	["custom", 'request {"url":"https://example.test/path?q=secret"}', 'request {"url":"https://example.test/path?q=<redacted>"}'],
	["custom", "https://example.test/path#fragment", "https://example.test/path#<redacted>"],
	["http.response.header.location", "#fragment", "#<redacted>"],
	["custom", "callback#fragment", "callback#<redacted>"],
	["url.full", "https://example.test/path?one=secret with spaces&two=other", "https://example.test/path?one=<redacted>&two=<redacted>"],
	["url.full", "https://[::1]:3000/path", "https://[::1]:3000/path"],
	["url.path", "/readable/path", "/readable/path"],
	["custom", "ordinary text", "ordinary text"],
	["custom", '{"url.query":"q=secret","url.fragment":"fragment"}', '{"url.query":"q=<redacted>","url.fragment":"<redacted>"}'],
	["custom", '[{"http.target":"/path?q=secret"}]', '[{"http.target":"/path?q=<redacted>"}]'],
	["custom", "{invalid https://example.test/path?q=secret", "{invalid https://example.test/path?q=<redacted>"],
])("redacts %s containing %s", (key, input, expected) => {
	expect(redactOtlpUrl(input, key)).toBe(expected);
});

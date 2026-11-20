import { expect, it } from "vitest";
import { isSensitiveKey, redactText } from "#sensitive.ts";

it.each([
	["password='a b c'", "password='<redacted>'"],
	['password="a b c"', 'password="<redacted>"'],
	["password = 'a b c' status=ready", "password = '<redacted>' status=ready"],
	['token: "a b c"; status=ready', 'token: "<redacted>"; status=ready'],
	["password='a,b&c;d'", "password='<redacted>'"],
	['password="a,b&c;d"', 'password="<redacted>"'],
	["password='a b#c d'", "password='<redacted>"],
	['password="a b#c d"', 'password="<redacted>'],
	["password='a \"b\" c'", "password='<redacted>'"],
	["password=\"a 'b' c\"", 'password="<redacted>"'],
	["password='a \\'b\\' c' status=ready", "password='<redacted>' status=ready"],
	['password="a \\"b\\" c" status=ready', 'password="<redacted>" status=ready'],
	["password='a\nb\tc'", "password='<redacted>'"],
	['password="a\nb\tc"', 'password="<redacted>"'],
	["password='a b c' token=other", "password='<redacted>' token=<redacted>"],
	["password='a b c' token=\"d e f\"", "password='<redacted>' token=\"<redacted>\""],
	['password=first,token="a b c";secret=last', 'password=<redacted>,token="<redacted>";secret=<redacted>'],
	['{"password":"a b c","status":"ready"}', '{"password":"<redacted>","status":"ready"}'],
	['{"token":"a b c","status":"ready"}', '{"token":"<redacted>","status":"ready"}'],
	['{"token":"a \\"b\\" c","status":"ready"}', '{"token":"<redacted>","status":"ready"}'],
	["password=abc&status=ready", "password=<redacted>&status=ready"],
	["password='abc", "password='<redacted>"],
	['password="abc', 'password="<redacted>'],
	["password='a b c", "password='<redacted>"],
	['password="a b c', 'password="<redacted>'],
	["status='a b c'", "status='a b c'"],
	['status="a b c"', 'status="a b c"'],
	['{"status":"a b c"}', '{"status":"a b c"}'],
	["ordinary public text", "ordinary public text"],
	['context="password=abc"', 'context="password=<redacted>"'],
])("redacts complete credential assignments in %s", (input, expected) => {
	expect(redactText(input, isSensitiveKey)).toBe(expected);
});

it("uses the caller's sensitive-name policy for quoted assignments", () => {
	expect(redactText("note='a b c' status='ready now'", (key) => key === "note")).toBe("note='<redacted>' status='ready now'");
});

it("redacts the complete quoted value before truncating", () => {
	expect(redactText(`password='${"secret ".repeat(500)}'`, isSensitiveKey, 30)).toBe("password='<redacted>'");
});

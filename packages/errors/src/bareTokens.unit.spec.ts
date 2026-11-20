import { expect, it } from "vitest";
import { isSensitiveKey, redactText } from "#sensitive.ts";

const body = "a1B2c3D4e5".repeat(4);

it.each([
	["a GitHub personal access token", `ghp_${body.slice(0, 36)}`],
	["a GitHub OAuth token", `gho_${body.slice(0, 36)}`],
	["a GitHub server token", `ghs_${body.slice(0, 36)}`],
	["a GitHub user-to-server token", `ghu_${body.slice(0, 36)}`],
	["a GitHub refresh token", `ghr_${body.slice(0, 36)}`],
	["a GitHub fine-grained token", `github_pat_${body.slice(0, 22)}_${body}`],
	["a Stripe live secret key", `sk_live_${body.slice(0, 24)}`],
	["a Stripe test secret key", `sk_test_${body.slice(0, 24)}`],
	["a Stripe live restricted key", `rk_live_${body.slice(0, 24)}`],
	["a Stripe test restricted key", `rk_test_${body.slice(0, 24)}`],
	["an AWS access key id", "AKIAIOSFODNN7EXAMPLE"],
	["an AWS temporary access key id", "ASIAIOSFODNN7EXAMPLE"],
	["a Slack bot token", `xoxb-123456789012-1234567890123-${body.slice(0, 24)}`],
	["a Slack user token", `xoxp-123456789012-${body.slice(0, 12)}`],
	["a Slack app token", `xoxa-2-${body.slice(0, 12)}`],
	["a Slack session token", `xoxs-${body.slice(0, 12)}`],
])("masks %s with no name in front", (_family, token) => {
	expect(redactText(`push failed with ${token} for the release`, isSensitiveKey)).toBe("push failed with <redacted> for the release");
});

const github = `ghp_${body.slice(0, 36)}`;

it.each([
	[String.raw`{"msg":"failed:\n${github}"}`, String.raw`{"msg":"failed:\n<redacted>"}`],
	[String.raw`{"msg":"failed:\t${github}"}`, String.raw`{"msg":"failed:\t<redacted>"}`],
	[String.raw`{"msg":"failed:\r${github}"}`, String.raw`{"msg":"failed:\r<redacted>"}`],
	[`next=%3D${github} failed`, "next=%3D<redacted> failed"],
	[`path%2F${github} was rejected`, "path%2F<redacted> was rejected"],
	[`path%2f${github} was rejected`, "path%2f<redacted> was rejected"],
])("masks a token right after an escape in %s", (input, expected) => {
	expect(redactText(input, isSensitiveKey)).toBe(expected);
});

it.each([
	["skill_level=3 status=ready"],
	["AKIARA and AKIAIOSFODNN7EXAMPLE2 are not key ids"],
	["sk_test_mode ghp_short xoxo-hugs"],
	[String.raw`\nskill_level %3DAKIARA %2Fsk_test_mode`],
	[`x${"ghp_"}${"a1B2c3D4e5".repeat(4)}`],
	["ghp_ is the prefix of a GitHub token"],
])("leaves %s readable", (input) => {
	expect(redactText(input, isSensitiveKey)).toBe(input);
});

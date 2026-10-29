import { seedCookies } from "@shivaedev/test-story/server/seedCookies.ts";

export function sessionCookie(token?: string) {
	return seedCookies([
		{
			...(token === undefined ? { expires: 0 } : {}),
			httpOnly: true,
			name: "live-session",
			path: "/",
			value: token ?? "",
		},
	]);
}

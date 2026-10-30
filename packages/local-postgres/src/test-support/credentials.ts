import { inspect } from "node:util";

export const ROLE_PASSWORD = "query-role-%+:@/password";
const IGNORED_USERINFO_PASSWORD = "ignored-userinfo-%+:@/password";
const IGNORED_QUERY_PASSWORD = "ignored-query-%+:@/password";

const passwords = [
	["the query role's password", ROLE_PASSWORD],
	["the ignored userinfo password", IGNORED_USERINFO_PASSWORD],
	["the ignored query password", IGNORED_QUERY_PASSWORD],
] as const;

export interface Credentials {
	readonly name: string;
	readonly search: string;
	readonly userinfo: string;
}

function parameter(password: string) {
	return encodeURIComponent(password);
}

export const credentialForms: readonly Credentials[] = [
	{ name: "the password in the URL's userinfo", search: "", userinfo: ROLE_PASSWORD },
	{ name: "a password query parameter", search: `?password=${parameter(ROLE_PASSWORD)}`, userinfo: "" },
	{
		name: "a password query parameter beside a different userinfo password",
		search: `?password=${parameter(ROLE_PASSWORD)}`,
		userinfo: IGNORED_USERINFO_PASSWORD,
	},
	{
		name: "the last of two password query parameters",
		search: `?password=${parameter(IGNORED_QUERY_PASSWORD)}&password=${parameter(ROLE_PASSWORD)}`,
		userinfo: IGNORED_USERINFO_PASSWORD,
	},
	{ name: "a password query parameter with a literal +", search: `?password=${parameter(ROLE_PASSWORD).replaceAll("%2B", "+")}`, userinfo: "" },
];

export function connectionAs(server: string, role: string, credentials: Credentials) {
	const connection = new URL(server);
	connection.username = role;
	connection.password = encodeURIComponent(credentials.userinfo);
	connection.search = credentials.search;
	return connection;
}

export function passwordsShownIn(failure: unknown) {
	const details = inspect(failure, { depth: null });
	return passwords
		.filter(([, password]) => [password, parameter(password), parameter(password).replaceAll("%2B", "+")].some((form) => details.includes(form)))
		.map(([label]) => label);
}

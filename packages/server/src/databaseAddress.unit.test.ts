import { Redacted } from "effect";
import { expect, it } from "vitest";
import { databaseAddress } from "./databaseAddress.ts";

it.each([
	["postgresql://user:secret@db.internal:6432/app", { host: "db.internal", port: 6432 }],
	["postgres://db.internal/app", { host: "db.internal" }],
	["postgresql://[::1]:6432/app", { host: "::1", port: 6432 }],
	["postgresql://db%2einternal/app", { host: "db.internal" }],
	["postgresql://ignored:123/app?host=first&port=1&host=db.internal&port=6432", { host: "db.internal", port: 6432 }],
	["postgresql://ignored/app?host=", { host: "" }],
	["postgresql:///app?port=6432", { port: 6432 }],
	["postgresql:///app", {}],
	["postgresql://%2Fvar%2Frun%2Fpostgresql:6432/app", { host: "/var/run/postgresql", port: 6432 }],
	["postgresql:///app?host=%2Fvar%2Frun%2Fpostgresql&port=6432", { host: "/var/run/postgresql", port: 6432 }],
] as const)("derives only the address fields from %s", (url, expected) => {
	expect(databaseAddress(Redacted.make(url))).toEqual(expected);
});

it.each([
	"not a URL",
	"socket:/var/run/postgresql?db=app",
	"postgresql://db%zz/app",
	"postgresql://db:invalid/app",
	"postgresql://db/app?port=invalid",
	"postgresql://db/app?port=0",
	"postgresql://db/app?port=65536",
	"postgresql://first:5432,second:6432/app",
	"postgresql://first,second/app",
	"postgresql:///app?host=first,second&port=5432,6432",
	"postgresql:///app?host=first,second&port=5432",
])("leaves the original connection configuration alone for %s", (url) => {
	expect(databaseAddress(Redacted.make(url))).toEqual({});
});

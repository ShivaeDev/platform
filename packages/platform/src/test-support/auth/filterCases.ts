import type { Where } from "better-auth";

export const filterRows = [
	{ image: null, name: "A%_\\End" },
	{ image: "photo", name: "aXXEnd" },
	{ image: "other", name: "Zulu" },
];

export const filterCases: readonly { readonly label: string; readonly where: Where[]; readonly expected: readonly string[] }[] = [
	{ expected: ["A%_\\End"], label: "null equality", where: [{ field: "image", value: null }] },
	{ expected: ["aXXEnd", "Zulu"], label: "null inequality", where: [{ field: "image", operator: "ne", value: null }] },
	{ expected: ["A%_\\End", "aXXEnd"], label: "string inequality", where: [{ field: "name", operator: "ne", value: "Zulu" }] },
	{ expected: ["A%_\\End"], label: "less than", where: [{ field: "name", operator: "lt", value: "B" }] },
	{ expected: ["A%_\\End"], label: "less or equal", where: [{ field: "name", operator: "lte", value: "A%_\\End" }] },
	{ expected: ["aXXEnd"], label: "greater than", where: [{ field: "name", operator: "gt", value: "Zulu" }] },
	{ expected: ["aXXEnd"], label: "greater or equal", where: [{ field: "name", operator: "gte", value: "aXXEnd" }] },
	{ expected: [], label: "empty membership", where: [{ field: "name", operator: "in", value: [] }] },
	{ expected: ["aXXEnd"], label: "ordinary membership", where: [{ field: "image", operator: "in", value: ["photo"] }] },
	{ expected: ["A%_\\End", "aXXEnd", "Zulu"], label: "empty exclusion", where: [{ field: "name", operator: "not_in", value: [] }] },
	{ expected: ["A%_\\End", "aXXEnd"], label: "ordinary exclusion", where: [{ field: "name", operator: "not_in", value: ["Zulu"] }] },
	{
		expected: ["A%_\\End"],
		label: "insensitive literal membership",
		where: [{ field: "name", mode: "insensitive", operator: "in", value: ["a%_\\end"] }],
	},
	{
		expected: ["aXXEnd", "Zulu"],
		label: "insensitive literal exclusion",
		where: [{ field: "name", mode: "insensitive", operator: "not_in", value: ["a%_\\end"] }],
	},
	{
		expected: ["aXXEnd", "Zulu"],
		label: "insensitive inequality",
		where: [{ field: "name", mode: "insensitive", operator: "ne", value: "a%_\\end" }],
	},
	{ expected: ["A%_\\End"], label: "literal contains", where: [{ field: "name", operator: "contains", value: "%_\\" }] },
	{ expected: ["A%_\\End"], label: "literal starts with", where: [{ field: "name", mode: "insensitive", operator: "starts_with", value: "a%_\\" }] },
	{ expected: ["A%_\\End", "aXXEnd"], label: "ends with", where: [{ field: "name", operator: "ends_with", value: "End" }] },
	{
		expected: ["Zulu"],
		label: "OR group combined with AND",
		where: [
			{ field: "image", operator: "ne", value: null },
			{ connector: "OR", field: "name", value: "A%_\\End" },
			{ connector: "OR", field: "name", value: "Zulu" },
		],
	},
];

#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { normalizePrismaNextContractTypes } from "../internal/contract-normalization.js";

const arguments_ = process.argv.slice(2);
if (arguments_.length !== 1 || arguments_[0] === undefined) {
	throw new Error("Usage: effect-prisma-normalize <generated-contract.d.ts>");
}

const contractPath = arguments_[0];
const source = await readFile(contractPath, "utf8");
const normalized = normalizePrismaNextContractTypes(source);

if (normalized !== source) {
	await writeFile(contractPath, normalized);
}

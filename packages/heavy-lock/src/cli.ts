#!/usr/bin/env node
import process from "node:process";
import { NodeChildProcessSpawner, NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { program } from "./cli/program.ts";

const services = NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)));

process.exitCode = await Effect.runPromise(Effect.provide(program(process.argv.slice(2)), services));

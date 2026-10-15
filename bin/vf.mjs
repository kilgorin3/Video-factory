#!/usr/bin/env node
// Global entry point (`npm link` exposes `vf`). Runs the TypeScript CLI through tsx.
import { register } from "tsx/esm/api";

register();
await import("../src/cli.ts");

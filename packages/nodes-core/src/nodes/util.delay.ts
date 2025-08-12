import { defineNode } from "@flowforge/sdk";
import { z } from "zod";

export default defineNode({
  kind: "action",
  name: "util.delay",
  version: "1.0.0",
  inputs: ["in"],
  outputs: ["out"],
  schema: z.object({ ms: z.number().int().min(0).max(600000).default(1000) }),
  async execute(ctx, cfg, input){
    await new Promise(res=>setTimeout(res, cfg.ms));
    return { output: input, next: { out: true } };
  }
});

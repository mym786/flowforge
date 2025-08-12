import { defineNode } from "@flowforge/sdk";
import { z } from "zod";

export default defineNode({
  kind: "trigger",
  name: "queue.redis",
  version: "1.0.0",
  outputs: ["message"],
  schema: z.object({
    channel: z.string()
  }),
  async execute(ctx, cfg, input){
    // In this minimal spec, queue consumption is managed by platform; node simply passes message through
    return { output: input, next: { message: true } };
  }
});

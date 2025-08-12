import { defineNode } from "@flowforge/sdk";
import { z } from "zod";

export default defineNode({
  kind: "trigger",
  name: "trigger.cron",
  version: "1.0.0",
  outputs: ["tick"],
  schema: z.object({
    cron: z.string(), // linux cron string
    timezone: z.string().default("UTC")
  }),
  async execute(ctx, cfg){
    // Trigger nodes are scheduled by the platform; at run-time just emit a tick
    ctx.log("info","cron tick",{ cron: cfg.cron });
    return { output: { now: new Date().toISOString() }, next: { tick: true } };
  }
});

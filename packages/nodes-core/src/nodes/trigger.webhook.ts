import { defineNode } from "@flowforge/sdk";
import { z } from "zod";

export default defineNode({
  kind: "trigger",
  name: "trigger.webhook",
  version: "1.0.0",
  outputs: ["incoming"],
  schema: z.object({}),
  async execute(ctx){
    // Webhook events push input via API; trigger emits once per request
    return { output: { accepted: true }, next: { incoming: true } };
  }
});

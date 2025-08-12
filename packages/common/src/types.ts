import { z } from "zod";

export const PortRef = z.object({ node: z.string(), port: z.string() });
export const EdgeSchema = z.object({
  id: z.string(),
  from: PortRef,
  to: PortRef,
  condition: z.string().optional()
});
export const NodeRetry = z.object({
  maxAttempts: z.number().int().min(0).default(0),
  backoffStrategy: z.enum(["none","fixed","exponential"]).default("exponential"),
  backoffMs: z.number().int().min(0).default(1000)
});
export const NodeSchema = z.object({
  id: z.string(),
  type: z.string(), // e.g., "http.request"
  version: z.string().default("1.0.0"),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  config: z.record(z.any()).default({}),
  credentialsRef: z.string().optional(),
  retry: NodeRetry.default({} as any),
  timeoutMs: z.number().int().min(0).default(60000)
});

export const WorkflowSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  concurrency: z.number().int().min(1).max(64).default(10),
  allowCycles: z.boolean().default(false)
});

export type WorkflowDef = z.infer<typeof WorkflowSchema>;
export type NodeDef = z.infer<typeof NodeSchema>;

export type LogEvent = {
  ts: string;
  runId: string;
  nodeId?: string;
  level: "debug"|"info"|"warn"|"error";
  msg: string;
  data?: any;
};

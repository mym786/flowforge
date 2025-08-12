import { z } from "zod";

export type NodeContext = {
  log: (level: "debug"|"info"|"warn"|"error", msg: string, data?: any)=>void;
  fetch: typeof fetch;
  env: Record<string,string|undefined>;
  credentials?: Record<string, any>;
  signal: AbortSignal;
  checkpoint: (data: any)=>Promise<void>;
  getCheckpoint: ()=>Promise<any>;
};

export type ExecResult = { output?: any; next?: Record<string, boolean> };

export type NodeSpec = {
  kind: "trigger" | "action";
  name: string; // e.g., "http.request"
  version: string;
  inputs?: string[];
  outputs?: string[];
  schema: ReturnType<typeof z.object>;
  execute: (ctx: NodeContext, config: any, input?: any) => Promise<ExecResult>;
  onInstall?: ()=>Promise<void>;
  onValidate?: (config: any)=>Promise<void>;
  onMigrate?: (fromVersion: string, toVersion: string, config: any)=>Promise<any>;
};

export function defineNode(spec: NodeSpec){ return spec; }

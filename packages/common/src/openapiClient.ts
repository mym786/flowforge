// very small generated client facade (hand-authored for brevity)
export type RequestOptions = { baseUrl?: string; token?: string; };
async function request<T>(path: string, init: RequestInit, opts?: RequestOptions): Promise<T> {
  const url = (opts?.baseUrl || "") + path;
  const res = await fetch(url, { ...init, headers: { "Content-Type":"application/json", ...(init.headers||{}), ...(opts?.token?{Authorization:`Bearer ${opts.token}`}:{}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
export const ApiClient = (opts?: RequestOptions) => ({
  listWorkflows: () => request("/api/workflows", { method: "GET" }, opts),
  getWorkflow: (id: string) => request(`/api/workflows/${id}`, { method: "GET" }, opts),
  createWorkflow: (payload: any) => request("/api/workflows", { method: "POST", body: JSON.stringify(payload) }, opts),
  updateWorkflow: (id: string, payload: any) => request(`/api/workflows/${id}`, { method: "PUT", body: JSON.stringify(payload) }, opts),
  deleteWorkflow: (id: string) => request(`/api/workflows/${id}`, { method: "DELETE" }, opts),
  executeWorkflow: (id: string, input?: any) => request(`/api/execute/${id}`, { method: "POST", body: JSON.stringify({ input }) }, opts),
  listRuns: (workflowId: string) => request(`/api/workflows/${workflowId}/runs`, { method: "GET" }, opts),
});

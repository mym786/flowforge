import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiClient } from "@flowforge/common";

const api = ApiClient({ baseUrl: "" });

export default function App(){
  const { data: workflows } = useQuery({ queryKey:["workflows"], queryFn: ()=>api.listWorkflows() });
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">FlowForge</h1>
      <a href="/docs" className="text-blue-600 underline">API Docs</a>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {workflows?.map((w:any)=>(
          <div key={w.id} className="rounded-xl border p-4 shadow-sm bg-white">
            <div className="font-semibold">{w.name}</div>
            <div className="text-sm text-gray-500">{w.slug}</div>
            <div className="mt-2 flex gap-2">
              <button className="px-3 py-1 rounded bg-black text-white" onClick={async()=>{
                const res = await api.executeWorkflow(w.id, { hello: "world" });
                alert("Queued run " + res.runId);
              }}>Run</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

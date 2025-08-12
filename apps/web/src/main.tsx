import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./pages/App";
import "./style.css";

const root = createRoot(document.getElementById("root")!);
const qc = new QueryClient();
root.render(<QueryClientProvider client={qc}><App/></QueryClientProvider>);

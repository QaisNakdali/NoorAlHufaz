import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { parentTokenFromLocation } from "./parent/entry";

const token = parentTokenFromLocation(window.location);
if (token) document.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.setAttribute("content", "width=device-width, initial-scale=1.0, viewport-fit=cover");
// The teacher entry and AppProvider remain unchanged; parents never mount them.
const Screen = token
  ? lazy(() => import("./parent/ParentApp").then(module => ({ default: () => <module.default token={token} /> })))
  : lazy(() => import("./App"));
ReactDOM.createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<div role="status" dir="rtl" style={{ minHeight: "100svh", display: "grid", placeItems: "center", background: "#f8f7fc", color: "#665590", fontFamily: "sans-serif" }}>جارٍ فتح نور الحفاظ…</div>}><Screen /></Suspense>
);

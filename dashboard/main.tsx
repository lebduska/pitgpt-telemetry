/**
 * PitGPT Dashboard — React entry point.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

const container = document.getElementById("content")!;
const root = createRoot(container);
root.render(<App />);

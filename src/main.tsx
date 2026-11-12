import { createRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/instrument-sans";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource-variable/newsreader/wght-italic.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(<App />);

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    base: "/endfield_puzzle_resolver/",
    plugins: [react()],
    worker: {
        format: "es",
    },
});

import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {};

const app = new Hono<{ Bindings: Bindings }>();

app.use(
    "*",
    cors({
        origin: "*",
        allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
    })
);

app.get("/health", (c) => {
    return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/openai/*", async (c) => {
    try {
        const apiKey = c.req.header("Authorization")?.split(" ")[1];
        if (!apiKey) {
            return c.json({ error: "API key not configured" }, 500);
        }
        console.log(c.req);

        // Get path and query string from the request
        const url = new URL(c.req.url);
        let path = url.pathname;
        let queryString = url.search;

        if (path.startsWith("/openai/")) {
            // Remove "/openai" prefix from the path
            path = path.replace(/^\/openai/, "");
            // Optionally, you can log or handle the query string if needed
        }
        if (path.startsWith("openai/")) {
            // Handle cases where the path starts with "openai/"
            path = path.replace(/^openai\//, "");
        }

        if (queryString.startsWith("?")) {
            // Remove leading "?" from the query string
            queryString = queryString.slice(1);
        }
        const body = await c.req.json();

        const response = await fetch(
            `https://api.openai.com/${path}?${queryString}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type":
                        c.req.header("Content-Type") || "application/json",
                    "User-Agent":
                        c.req.header("User-Agent") || "PostmanRuntime/7.44.1",
                    Connection: c.req.header("Connection") || "keep-alive",
                },
                body: JSON.stringify(body),
            }
        );

        const data = (await response.json()) as any;
        return c.json(data, response.status as any);
    } catch (error) {
        console.error("Error in chat completions:", error);
        return c.json({ error: "Internal server error" }, 500);
    }
});

app.onError((err, c) => {
    console.error("Global error handler:", err);
    return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => {
    return c.json({ error: "Not found" }, 404);
});

export default app;

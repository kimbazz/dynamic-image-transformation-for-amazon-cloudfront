import http from "node:http";
import { handler as lambdaHandler } from "./index";

const PORT = parseInt(process.env.PORT || "47890", 10);

// Ensure API-Gateway-style response from the handler
if (!process.env.ENABLE_S3_OBJECT_LAMBDA) {
	process.env.ENABLE_S3_OBJECT_LAMBDA = "No";
}

function toEvent(req: http.IncomingMessage): any {
	const url = new URL(req.url || "/", "http://localhost");
	const headers: Record<string, string> = {};
	for (const [k, v] of Object.entries(req.headers)) {
		headers[k] = Array.isArray(v) ? v.join(",") : String(v ?? "");
	}

	const queryStringParameters: Record<string, string> = {};
	for (const [k, v] of url.searchParams.entries()) {
		queryStringParameters[k] = v;
	}

	return {
		path: url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname,
		queryStringParameters,
		headers,
		requestContext: {},
	};
}

const server = http.createServer(async (req, res) => {
	try {
		if (!req.url) {
			res.statusCode = 400;
			return res.end("Bad Request");
		}

		// Basic health checks for k8s
		if (req.method === "GET" && (req.url === "/healthz" || req.url === "/readyz")) {
			res.statusCode = 200;
			res.setHeader("Content-Type", "text/plain");
			return res.end("ok");
		}

		const event = toEvent(req);
		const result = (await lambdaHandler(event)) as {
			statusCode: number;
			isBase64Encoded?: boolean;
			headers?: Record<string, string>;
			body?: string;
		};

		res.statusCode = result?.statusCode ?? 500;

		if (result?.headers) {
			for (const [k, v] of Object.entries(result.headers)) {
				if (typeof v === "string") res.setHeader(k, v);
			}
		}

		if (result?.body) {
			if (result.isBase64Encoded) {
				const buf = Buffer.from(result.body, "base64");
				return res.end(buf);
			}
			return res.end(result.body);
		}

		return res.end();
	} catch (err) {
		console.error(err);
		res.statusCode = 500;
		res.setHeader("Content-Type", "application/json");
		res.end(JSON.stringify({ message: "Internal Server Error" }));
	}
});

server.listen(PORT, () => {
	console.log(`Image handler listening on :${PORT}`);
});
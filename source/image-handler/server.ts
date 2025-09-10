import http from "node:http";
import { handler as lambdaHandler } from "./index";

const PORT = parseInt(process.env.PORT || "47890", 10);
const REQUEST_TIMEOUT_MS = 500; // 500ms timeout for client requests

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
		path: url.pathname.startsWith("/") ? url.pathname.slice(0) : url.pathname,
		queryStringParameters,
		headers,
		requestContext: {},
	};
}

const server = http.createServer(async (req, res) => {
	let isResponseSent = false;
	let timeoutId: NodeJS.Timeout | null = null;

	// Set up request timeout
	timeoutId = setTimeout(() => {
		if (!isResponseSent) {
			isResponseSent = true;
			console.error(`Request timeout: ${req.url} took longer than ${REQUEST_TIMEOUT_MS}ms`);
			res.statusCode = 500;
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify({ message: "Internal Server Error - Request Timeout" }));
		}
	}, REQUEST_TIMEOUT_MS);

	const sendResponse = (callback: () => void) => {
		if (!isResponseSent) {
			isResponseSent = true;
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
			callback();
		}
	};

	try {
		if (!req.url) {
			return sendResponse(() => {
				res.statusCode = 400;
				res.end("Bad Request!");
			});
		}

		// Basic health checks for k8s
		if (req.method === "GET" && (req.url === "/healthz" || req.url === "/readyz")) {
			return sendResponse(() => {
				res.statusCode = 200;
				res.setHeader("Content-Type", "text/plain");
				res.end("ok!");
			});
		}

		const event = toEvent(req);
		const result = (await lambdaHandler(event)) as {
			statusCode: number;
			isBase64Encoded?: boolean;
			headers?: Record<string, string>;
			body?: string;
		};

		sendResponse(() => {
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
		});
	} catch (err) {
		console.error(err);
		sendResponse(() => {
			res.statusCode = 500;
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify({ message: "Internal Server Error!" }));
		});
	}
});

server.listen(PORT, () => {
	console.log(`Image handler listening on :${PORT}`);
});
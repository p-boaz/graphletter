import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { progressTracker } from "@/lib/websocket/progress-tracker";
import { getCurrentUser } from "@/utils/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const sessionId = searchParams.get("sessionId");

	if (!sessionId) {
		return new Response(JSON.stringify({ error: "Session ID is required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const supabase = await createClient();
	const user = await getCurrentUser(supabase).catch(() => null);
	if (!user) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const session = progressTracker.getSession(sessionId);
	if (!session) {
		return new Response(
			JSON.stringify({ error: "Progress session not found" }),
			{
				status: 404,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
	if (session.userId !== user.id) {
		return new Response(JSON.stringify({ error: "Forbidden" }), {
			status: 403,
			headers: { "Content-Type": "application/json" },
		});
	}

	const headers = new Headers({
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
	});

	let unsubscribe: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date().toISOString() })}\n\n`,
						),
					);
				} catch {
					clearInterval(heartbeat);
				}
			}, 30000);

			const close = () => {
				if (unsubscribe) {
					unsubscribe();
					unsubscribe = null;
				}
				if (heartbeat) {
					clearInterval(heartbeat);
				}
				try {
					controller.close();
				} catch {
					// already closed
				}
			};

			controller.enqueue(
				encoder.encode(
					`data: ${JSON.stringify({ type: "connected", sessionId, operation: session.operation })}\n\n`,
				),
			);

			unsubscribe = progressTracker.subscribe(sessionId, (update) => {
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({ type: "progressUpdate", update })}\n\n`,
					),
				);

				if (update.stage === "completed" || update.stage === "error") {
					setTimeout(close, 2000);
				}
			});

			request.signal.addEventListener("abort", close);
		},
		cancel() {
			if (unsubscribe) {
				unsubscribe();
				unsubscribe = null;
			}
		},
	});

	return new Response(stream, { headers });
}

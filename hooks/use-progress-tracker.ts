import { useCallback, useEffect, useRef, useState } from "react";
import type { ProgressUpdate } from "@/lib/websocket/progress-tracker";

export interface ProgressState {
	sessionId: string | null;
	stage: string;
	progress: number;
	message: string;
	status:
		| "connecting"
		| "connected"
		| "active"
		| "completed"
		| "error"
		| "disconnected";
	timestamp: string | null;
	metadata?: Record<string, unknown>;
}

export interface UseProgressTrackerOptions {
	onProgress?: (update: ProgressUpdate) => void;
	onComplete?: (sessionId: string) => void;
	onError?: (error: string) => void;
	autoReconnect?: boolean;
	reconnectDelay?: number;
}

export function useProgressTracker(options: UseProgressTrackerOptions = {}) {
	const {
		onProgress,
		onComplete,
		onError,
		autoReconnect = true,
		reconnectDelay = 5000,
	} = options;

	const [progressState, setProgressState] = useState<ProgressState>({
		sessionId: null,
		stage: "idle",
		progress: 0,
		message: "Ready",
		status: "disconnected",
		timestamp: null,
	});

	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isConnectingRef = useRef(false);
	const expectedCloseRef = useRef(false);
	const statusRef = useRef<ProgressState["status"]>("disconnected");
	const connectRef = useRef<((sessionId: string) => void) | null>(null);

	useEffect(() => {
		statusRef.current = progressState.status;
	}, [progressState.status]);

	/**
	 * Disconnect from progress updates
	 */
	const disconnect = useCallback(() => {
		expectedCloseRef.current = true;

		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}

		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}

		isConnectingRef.current = false;

		setProgressState((prev) => ({
			...prev,
			status: "disconnected",
			message: "Disconnected",
		}));
	}, []);

	/**
	 * Connect to progress updates for a specific session
	 */
	const connect = useCallback(
		(sessionId: string) => {
			// Don't connect if already connecting to the same session
			if (isConnectingRef.current && progressState.sessionId === sessionId) {
				return;
			}

			// Disconnect existing connection
			disconnect();
			expectedCloseRef.current = false;

			isConnectingRef.current = true;
			setProgressState((prev) => ({
				...prev,
				sessionId,
				status: "connecting",
				message: "Connecting to progress updates...",
			}));

			try {
				const eventSource = new EventSource(
					`/api/ws/progress?sessionId=${sessionId}`,
				);
				eventSourceRef.current = eventSource;

				eventSource.onopen = () => {
					isConnectingRef.current = false;
					expectedCloseRef.current = false;
					setProgressState((prev) => ({
						...prev,
						status: "connected",
						message: "Connected to progress updates",
						timestamp: new Date().toISOString(),
					}));
				};

				eventSource.onmessage = (event) => {
					try {
						const data = JSON.parse(event.data);

						switch (data.type) {
							case "connected":
								setProgressState((prev) => ({
									...prev,
									status: "connected",
									message: "Connected to progress updates",
									timestamp: new Date().toISOString(),
								}));
								break;

							case "progressUpdate": {
								const update = data.update as ProgressUpdate;
								setProgressState((prev) => ({
									...prev,
									stage: update.stage,
									progress: update.progress,
									message: update.message,
									status:
										update.stage === "completed"
											? "completed"
											: update.stage === "error"
												? "error"
												: "active",
									timestamp: update.timestamp,
									metadata: update.metadata,
								}));

								// Call callbacks
								onProgress?.(update);

								if (update.stage === "completed") {
									onComplete?.(sessionId);
									expectedCloseRef.current = true;
									eventSource.close();
									if (eventSourceRef.current === eventSource) {
										eventSourceRef.current = null;
									}
								} else if (update.stage === "error") {
									onError?.(update.message);
									expectedCloseRef.current = true;
									eventSource.close();
									if (eventSourceRef.current === eventSource) {
										eventSourceRef.current = null;
									}
								}
								break;
							}

							case "heartbeat":
								// Update timestamp to show connection is alive
								setProgressState((prev) => ({
									...prev,
									timestamp: data.timestamp,
								}));
								break;

							default:
								console.log("Unknown progress message type:", data.type);
						}
					} catch (error) {
						console.error("Error parsing progress message:", error);
					}
				};

				eventSource.onerror = (error) => {
					if (eventSourceRef.current !== eventSource) {
						return;
					}

					const isExpectedClose =
						expectedCloseRef.current ||
						statusRef.current === "completed" ||
						statusRef.current === "error" ||
						statusRef.current === "disconnected";

					if (isExpectedClose) {
						eventSource.close();
						eventSourceRef.current = null;
						isConnectingRef.current = false;
						return;
					}

					console.error("Progress EventSource error:", error);
					isConnectingRef.current = false;

					setProgressState((prev) => ({
						...prev,
						status: "disconnected",
						message: "Connection lost",
					}));

					// Auto-reconnect if enabled
					if (autoReconnect && statusRef.current !== "completed") {
						reconnectTimeoutRef.current = setTimeout(() => {
							connectRef.current?.(sessionId);
						}, reconnectDelay);
					}

					onError?.("Connection lost");
				};
			} catch (error) {
				isConnectingRef.current = false;
				console.error("Error creating EventSource:", error);
				setProgressState((prev) => ({
					...prev,
					status: "error",
					message: "Failed to connect",
				}));
				onError?.("Failed to connect to progress updates");
			}
		},
		[
			progressState.sessionId,
			disconnect,
			autoReconnect,
			reconnectDelay,
			onProgress,
			onComplete,
			onError,
		],
	);

	useEffect(() => {
		connectRef.current = connect;
	}, [connect]);

	/**
	 * Reset progress state
	 */
	const reset = useCallback(() => {
		disconnect();
		setProgressState({
			sessionId: null,
			stage: "idle",
			progress: 0,
			message: "Ready",
			status: "disconnected",
			timestamp: null,
		});
	}, [disconnect]);

	/**
	 * Check if currently tracking progress
	 */
	const isTracking =
		progressState.status === "active" || progressState.status === "connected";

	/**
	 * Check if connection is established
	 */
	const isConnected =
		progressState.status === "connected" || progressState.status === "active";

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			disconnect();
		};
	}, [disconnect]);

	return {
		progressState,
		connect,
		disconnect,
		reset,
		isTracking,
		isConnected,
	};
}

/**
 * Hook for creating and tracking a new progress session
 */
export function useProgressSession(options: UseProgressTrackerOptions = {}) {
	const progressTracker = useProgressTracker(options);
	const [sessionId, setSessionId] = useState<string | null>(null);

	/**
	 * Start a new progress session
	 */
	const startSession = useCallback(
		async (operation: string) => {
			try {
				const response = await fetch("/api/progress/session", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ operation }),
				});

				const result = await response.json();

				if (!response.ok || !result.sessionId) {
					throw new Error(result.error || "Unable to start progress session");
				}

				setSessionId(result.sessionId);
				progressTracker.connect(result.sessionId);
				return result.sessionId as string;
			} catch (error) {
				console.error("Failed to start progress session", error);
				progressTracker.disconnect();
				progressTracker.reset();
				return null;
			}
		},
		[progressTracker],
	);

	/**
	 * End the current session
	 */
	const endSession = useCallback(
		async (
			options: { status?: "completed" | "error"; message?: string } = {},
		) => {
			if (sessionId) {
				if (options.status) {
					try {
						await fetch(`/api/progress/session/${sessionId}`, {
							method: "PATCH",
							headers: {
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								status: options.status,
								message: options.message,
							}),
						});
					} catch (error) {
						console.error("Failed to finalize progress session", error);
					}
				}
			}

			progressTracker.disconnect();
			setSessionId(null);
		},
		[progressTracker, sessionId],
	);

	const reportError = useCallback(
		async (message: string) => {
			if (!sessionId) return;

			try {
				await fetch(`/api/progress/session/${sessionId}`, {
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ status: "error", message }),
				});
			} catch (error) {
				console.error("Failed to report progress error", error);
			}
		},
		[sessionId],
	);

	return {
		...progressTracker,
		sessionId,
		startSession,
		endSession,
		reportError,
	};
}

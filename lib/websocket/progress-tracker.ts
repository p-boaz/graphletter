/**
 * Progress tracking system for real-time updates
 * This module manages progress state and broadcasts updates to connected WebSocket clients
 */

export interface ProgressUpdate {
	sessionId: string;
	stage: string;
	progress: number; // 0-100
	message: string;
	timestamp: string;
	metadata?: Record<string, unknown>;
}

export interface ProgressSession {
	sessionId: string;
	userId: string;
	operation: string;
	startTime: string;
	currentStage: string;
	progress: number;
	status: "active" | "completed" | "error";
}

class ProgressTracker {
	private sessions: Map<string, ProgressSession> = new Map();
	private subscribers: Map<string, Set<(update: ProgressUpdate) => void>> =
		new Map();

	/**
	 * Create a new progress session
	 */
	createSession(
		sessionId: string,
		userId: string,
		operation: string,
	): ProgressSession {
		const session: ProgressSession = {
			sessionId,
			userId,
			operation,
			startTime: new Date().toISOString(),
			currentStage: "initializing",
			progress: 0,
			status: "active",
		};

		this.sessions.set(sessionId, session);

		// Initialize subscribers set for this session
		if (!this.subscribers.has(sessionId)) {
			this.subscribers.set(sessionId, new Set());
		}

		this.broadcastUpdate(
			sessionId,
			"initializing",
			0,
			`Starting ${operation}...`,
		);

		return session;
	}

	/**
	 * Update progress for a session
	 */
	updateProgress(
		sessionId: string,
		stage: string,
		progress: number,
		message: string,
		metadata?: Record<string, unknown>,
	): void {
		const session = this.sessions.get(sessionId);
		if (!session) {
			console.warn(`Progress session ${sessionId} not found`);
			return;
		}

		session.currentStage = stage;
		session.progress = Math.min(100, Math.max(0, progress));

		this.broadcastUpdate(sessionId, stage, progress, message, metadata);
	}

	/**
	 * Mark session as completed
	 */
	completeSession(
		sessionId: string,
		message: string = "Operation completed",
	): void {
		const session = this.sessions.get(sessionId);
		if (!session) {
			console.warn(`Progress session ${sessionId} not found`);
			return;
		}

		session.status = "completed";
		session.progress = 100;

		this.broadcastUpdate(sessionId, "completed", 100, message);

		// Clean up after 30 seconds
		setTimeout(() => {
			this.cleanup(sessionId);
		}, 30000);
	}

	/**
	 * Mark session as error
	 */
	errorSession(sessionId: string, error: string): void {
		const session = this.sessions.get(sessionId);
		if (!session) {
			console.warn(`Progress session ${sessionId} not found`);
			return;
		}

		session.status = "error";

		this.broadcastUpdate(
			sessionId,
			"error",
			session.progress,
			`Error: ${error}`,
		);

		// Clean up after 30 seconds
		setTimeout(() => {
			this.cleanup(sessionId);
		}, 30000);
	}

	/**
	 * Subscribe to progress updates for a session
	 */
	subscribe(
		sessionId: string,
		callback: (update: ProgressUpdate) => void,
	): () => void {
		if (!this.subscribers.has(sessionId)) {
			this.subscribers.set(sessionId, new Set());
		}

		this.subscribers.get(sessionId)!.add(callback);

		// Send current state if session exists
		const session = this.sessions.get(sessionId);
		if (session) {
			callback({
				sessionId,
				stage: session.currentStage,
				progress: session.progress,
				message: `Current stage: ${session.currentStage}`,
				timestamp: new Date().toISOString(),
			});
		}

		// Return unsubscribe function
		return () => {
			const subscribers = this.subscribers.get(sessionId);
			if (subscribers) {
				subscribers.delete(callback);
			}
		};
	}

	/**
	 * Get session info
	 */
	getSession(sessionId: string): ProgressSession | undefined {
		return this.sessions.get(sessionId);
	}

	/**
	 * Get all sessions for a user
	 */
	getUserSessions(userId: string): ProgressSession[] {
		return Array.from(this.sessions.values()).filter(
			(session) => session.userId === userId,
		);
	}

	/**
	 * Broadcast update to all subscribers
	 */
	private broadcastUpdate(
		sessionId: string,
		stage: string,
		progress: number,
		message: string,
		metadata?: Record<string, unknown>,
	): void {
		const update: ProgressUpdate = {
			sessionId,
			stage,
			progress,
			message,
			timestamp: new Date().toISOString(),
			metadata,
		};

		const subscribers = this.subscribers.get(sessionId);
		if (subscribers) {
			subscribers.forEach((callback) => {
				try {
					callback(update);
				} catch (error) {
					console.error("Error in progress update callback:", error);
				}
			});
		}
	}

	/**
	 * Clean up session and subscribers
	 */
	private cleanup(sessionId: string): void {
		this.sessions.delete(sessionId);
		this.subscribers.delete(sessionId);
	}

	/**
	 * Clean up expired sessions (older than 1 hour)
	 */
	cleanupExpiredSessions(): void {
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

		for (const [sessionId, session] of this.sessions.entries()) {
			if (session.startTime < oneHourAgo && session.status !== "active") {
				this.cleanup(sessionId);
			}
		}
	}
}

// Ensure singleton survives hot reloads in dev (store on globalThis)
declare global {
	var __progressTrackerInstance__: ProgressTracker | undefined;
	var __progressTrackerCleanupInterval__: NodeJS.Timeout | undefined;
}

const globalForProgressTracker = globalThis as unknown as {
	__progressTrackerInstance__?: ProgressTracker;
	__progressTrackerCleanupInterval__?: NodeJS.Timeout;
};

const trackerInstance = globalForProgressTracker.__progressTrackerInstance__
	? globalForProgressTracker.__progressTrackerInstance__
	: new ProgressTracker();

if (!globalForProgressTracker.__progressTrackerInstance__) {
	globalForProgressTracker.__progressTrackerInstance__ = trackerInstance;
}

export const progressTracker = trackerInstance;

// Clean up expired sessions every 10 minutes
if (
	typeof window === "undefined" &&
	!globalForProgressTracker.__progressTrackerCleanupInterval__
) {
	globalForProgressTracker.__progressTrackerCleanupInterval__ = setInterval(
		() => {
			progressTracker.cleanupExpiredSessions();
		},
		10 * 60 * 1000,
	);
}

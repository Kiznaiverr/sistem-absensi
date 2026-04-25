/**
 * Import Progress Tracker Service
 * Tracks real-time progress for Excel import operations
 * Uses Map for in-memory session storage
 */

export interface ProgressEvent {
  stage:
    | "parsing"
    | "validating"
    | "checking_db"
    | "inserting"
    | "completed"
    | "error";
  current: number;
  total: number;
  percentage: number;
  message: string;
  error?: string;
  result?: any;
}

interface ProgressSession {
  sessionId: string;
  startTime: number;
  events: ProgressEvent[];
  isComplete: boolean;
  error?: string;
  result?: any;
}

export class ImportProgressService {
  private static sessions = new Map<string, ProgressSession>();
  private static readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  /**
   * Create new progress tracking session
   */
  static createSession(sessionId: string): void {
    this.sessions.set(sessionId, {
      sessionId,
      startTime: Date.now(),
      events: [],
      isComplete: false,
    });

    // Auto cleanup after timeout
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, this.SESSION_TIMEOUT);
  }

  /**
   * Add progress event to session
   */
  static addEvent(sessionId: string, event: ProgressEvent): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.events.push(event);
      if (event.stage === "completed" || event.stage === "error") {
        session.isComplete = true;
        if (event.result) session.result = event.result;
        if (event.error) session.error = event.error;
      }
    }
  }

  /**
   * Get session progress
   */
  static getSession(sessionId: string): ProgressSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get last event of session
   */
  static getLastEvent(sessionId: string): ProgressEvent | undefined {
    const session = this.sessions.get(sessionId);
    if (session && session.events.length > 0) {
      return session.events[session.events.length - 1];
    }
    return undefined;
  }

  /**
   * Delete session
   */
  static deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Check if session exists
   */
  static hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}

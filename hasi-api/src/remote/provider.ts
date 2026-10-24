/**
 * Contract for a future remote OpenCode execution backend.
 * No implementation ships in v1: the API does NOT execute remote agents yet.
 * Implementations must record remote_sessions, remote_calls and token_usage.
 */
export interface RemoteSessionHandle {
  remoteSessionId: string;
  providerSessionRef: string;
}

export interface RemoteCallResult {
  output: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface RemoteExecutionProvider {
  readonly name: string;
  startSession(input: {
    userId: string;
    deviceId?: string;
    agentId?: string;
  }): Promise<RemoteSessionHandle>;
  call(
    handle: RemoteSessionHandle,
    input: { prompt: string; model?: string },
  ): Promise<RemoteCallResult>;
  endSession(handle: RemoteSessionHandle): Promise<void>;
}

/** Registry stays empty until a real provider is implemented. */
export const remoteProviders = new Map<string, RemoteExecutionProvider>();

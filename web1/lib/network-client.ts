// Enhanced network client for reliable API communication
// Handles retries, timeouts, and network error recovery

interface NetworkConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

class NetworkClient {
  private config: NetworkConfig;

  constructor(config: Partial<NetworkConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
      timeout: config.timeout || 10000, // 10 seconds
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000, // 1 second
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private shouldRetry(error: any, attempt: number): boolean {
    if (attempt >= this.config.maxRetries) return false;

    // Retry on network errors
    if (error instanceof TypeError && error.message === 'Network request failed') return true;
    if (error.name === 'AbortError') return true;
    if (error.code === 'ECONNREFUSED') return true;
    if (error.code === 'ENOTFOUND') return true;

    // Retry on server errors (5xx)
    if (error.status >= 500) return true;

    return false;
  }

  async fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
    const fullUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;

    console.log(`🌐 NetworkClient: Attempting request to ${fullUrl}`);

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(fullUrl, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
          },
          mode: 'cors',
          credentials: 'same-origin',
          cache: 'no-cache',
        });

        clearTimeout(timeoutId);

        console.log(`✅ NetworkClient: Success on attempt ${attempt + 1}, status: ${response.status}`);
        return response;

      } catch (error) {
        console.error(`❌ NetworkClient: Attempt ${attempt + 1} failed:`, {
          error: error instanceof Error ? error.message : String(error),
          type: error instanceof Error ? error.constructor.name : typeof error,
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries,
          url: fullUrl
        });

        if (!this.shouldRetry(error, attempt)) {
          console.error('🚨 NetworkClient: Max retries reached or non-retryable error');
          throw error;
        }

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt); // Exponential backoff
          console.log(`⏳ NetworkClient: Retrying in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }

    throw new Error(`Network request failed after ${this.config.maxRetries + 1} attempts`);
  }

  async get(url: string, options: RequestInit = {}): Promise<Response> {
    return this.fetchWithRetry(url, { ...options, method: 'GET' });
  }

  async post(url: string, data?: any, options: RequestInit = {}): Promise<Response> {
    return this.fetchWithRetry(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put(url: string, data?: any, options: RequestInit = {}): Promise<Response> {
    return this.fetchWithRetry(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch(url: string, data?: any, options: RequestInit = {}): Promise<Response> {
    return this.fetchWithRetry(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(url: string, options: RequestInit = {}): Promise<Response> {
    return this.fetchWithRetry(url, { ...options, method: 'DELETE' });
  }
}

// Create singleton instance
export const networkClient = new NetworkClient();

// Helper functions for common API operations
export const apiRequest = {
  async verifySignupCode(data: { email: string; code: string }): Promise<any> {
    try {
      const response = await networkClient.post('/api/auth/verify-signup-code', data);
      const result = await response.json();

      if (response.ok && result.success) {
        return { success: true, data: result };
      } else {
        return { success: false, error: result.error || 'Verification failed' };
      }
    } catch (error) {
      console.error('🚨 API Request: Verify signup code failed:', error);
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    }
  },

  async sendSignupVerification(data: { email: string; firstName: string; lastName: string }): Promise<any> {
    try {
      const response = await networkClient.post('/api/auth/send-signup-verification', data);
      const result = await response.json();

      if (response.ok && result.success) {
        return { success: true, data: result };
      } else {
        return { success: false, error: result.error || 'Failed to send verification code' };
      }
    } catch (error) {
      console.error('🚨 API Request: Send signup verification failed:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  },

  async healthCheck(): Promise<boolean> {
    try {
      const response = await networkClient.get('/api/health');
      return response.ok;
    } catch (error) {
      console.error('🚨 API Request: Health check failed:', error);
      return false;
    }
  }
};

// Network status monitoring
export const networkStatus = {
  async checkConnectivity(): Promise<boolean> {
    try {
      await networkClient.get('/api/health', { mode: 'no-cors' });
      return true;
    } catch (error) {
      return false;
    }
  },

  async getNetworkInfo(): Promise<any> {
    if (typeof window === 'undefined') {
      return { isOnline: true, type: 'server' };
    }

    return {
      isOnline: navigator.onLine,
      type: 'unknown',
      effectiveType: (navigator as any).connection?.effectiveType || 'unknown',
      downlink: (navigator as any).connection?.downlink || 0,
      rtt: (navigator as any).connection?.rtt || 0,
    };
  }
};

export default networkClient;
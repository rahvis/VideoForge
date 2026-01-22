const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ==========================================
// API Client
// ==========================================

interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

class ApiClient {
    private getToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('token');
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const token = this.getToken();

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>),
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    }

    // System endpoints
    async getSystemStatus() {
        return this.request<{
            status: string;
            processing: {
                isLocked: boolean;
                lockedBy?: string;
            };
            storage: {
                totalVideos: number;
                totalSizeBytes: number;
            };
        }>('/system/status');
    }

    async getLockStatus() {
        return this.request<{
            isLocked: boolean;
            lockedBy?: string;
        }>('/system/lock');
    }

    // Prompt endpoints
    async enhancePrompt(prompt: string, duration: number) {
        return this.request<{
            enhancedPrompt: string;
            title: string;
            keywords: string[];
            segmentCount: number;
        }>('/prompts/enhance', {
            method: 'POST',
            body: JSON.stringify({ prompt, duration }),
        });
    }

    async decomposeScenes(prompt: string, duration: number) {
        return this.request<{
            scenes: Array<{
                sceneNumber: number;
                scenePrompt: string;
                visualDescription: string;
                transitionType: string;
            }>;
            segmentCount: number;
        }>('/prompts/decompose', {
            method: 'POST',
            body: JSON.stringify({ prompt, duration }),
        });
    }

    // Video endpoints
    async createVideo(prompt: string, duration: number, voiceId?: string, scenes?: Array<{
        sceneNumber: number;
        scenePrompt: string;
        visualDescription?: string;
        continuityNotes?: string;
        narrationText?: string;
        transitionType?: string;
        startTime: number;
        endTime: number;
    }>) {
        return this.request<{
            id: string;
            title: string;
            status: string;
            segmentCount: number;
        }>('/videos/create', {
            method: 'POST',
            body: JSON.stringify({ prompt, duration, voiceId, scenes }),
        });
    }

    async getVideos(page = 1, limit = 20) {
        return this.request<{
            videos: Array<{
                id: string;
                title: string;
                status: string;
                progress: number;
                targetDuration: number;
                thumbnail?: string;
                createdAt: string;
            }>;
            pagination: {
                page: number;
                limit: number;
                total: number;
                totalPages: number;
            };
        }>(`/videos?page=${page}&limit=${limit}`);
    }

    async getVideo(id: string) {
        return this.request<{
            id: string;
            title: string;
            status: string;
            progress: number;
            currentPhase?: string;
            currentSegment?: number;
            segmentCount: number;
            targetDuration: number;
            actualDuration?: number;
            scenes?: Array<{
                sceneNumber: number;
                scenePrompt: string;
            }>;
            files?: {
                final_720p?: { url: string };
                final_480p?: { url: string };
                thumbnail?: { url: string };
            };
        }>(`/videos/${id}`);
    }

    async getVideoStatus(id: string) {
        return this.request<{
            id: string;
            status: string;
            progress: number;
            currentPhase?: string;
            currentSegment?: number;
            segmentCount: number;
            completedSegments: number;
            isProcessing: boolean;
        }>(`/videos/${id}/status`);
    }

    async getVideoSegments(id: string) {
        return this.request<{
            segments: Array<{
                segmentNumber: number;
                status: string;
                progress: number;
            }>;
        }>(`/videos/${id}/segments`);
    }

    async cancelVideo(id: string) {
        return this.request('/videos/' + id + '/cancel', { method: 'POST' });
    }

    async deleteVideo(id: string) {
        return this.request('/videos/' + id, { method: 'DELETE' });
    }
}

export const api = new ApiClient();

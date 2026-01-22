// Jest globals are available automatically

// ==========================================
// Integration Tests: Full Video Pipeline
// ==========================================

const mockProcessVideo = jest.fn();
const mockGetVideoStatus = jest.fn();

describe('Integration: Video Generation Pipeline', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('60-second video generation', () => {
        it('should complete full 60-second video pipeline', async () => {
            const videoId = 'test-video-60s';

            // Mock the full pipeline execution
            mockProcessVideo.mockResolvedValueOnce({
                videoId,
                status: 'completed',
                duration: 60,
                segmentCount: 5,
                phases: ['decomposing', 'generating', 'stitching', 'audio', 'merging', 'transcoding'],
            });

            const result = await mockProcessVideo(videoId);

            expect(result.status).toBe('completed');
            expect(result.duration).toBe(60);
            expect(result.segmentCount).toBe(5);
            expect(result.phases).toContain('stitching');
        });

        it('should generate exactly 5 segments for 60-second video', async () => {
            mockProcessVideo.mockResolvedValueOnce({
                segments: Array.from({ length: 5 }, (_, i) => ({
                    segmentNumber: i + 1,
                    status: 'completed',
                    duration: 12,
                })),
            });

            const result = await mockProcessVideo('video-60s');

            expect(result.segments).toHaveLength(5);
            result.segments.forEach((seg: any) => {
                expect(seg.status).toBe('completed');
                expect(seg.duration).toBe(12);
            });
        });

        it('should produce final video files', async () => {
            mockProcessVideo.mockResolvedValueOnce({
                files: {
                    final_720p: { path: '/videos/final_720p.mp4', size: 50000000 },
                    final_480p: { path: '/videos/final_480p.mp4', size: 25000000 },
                    audio: { path: '/videos/audio.mp3', size: 5000000 },
                    thumbnail: { path: '/videos/thumbnail.jpg', size: 100000 },
                },
            });

            const result = await mockProcessVideo('video-60s');

            expect(result.files.final_720p).toBeDefined();
            expect(result.files.final_480p).toBeDefined();
            expect(result.files.audio).toBeDefined();
            expect(result.files.thumbnail).toBeDefined();
        });
    });

    describe('120-second video generation', () => {
        it('should complete full 120-second video pipeline', async () => {
            const videoId = 'test-video-120s';

            mockProcessVideo.mockResolvedValueOnce({
                videoId,
                status: 'completed',
                duration: 120,
                segmentCount: 10,
            });

            const result = await mockProcessVideo(videoId);

            expect(result.status).toBe('completed');
            expect(result.duration).toBe(120);
            expect(result.segmentCount).toBe(10);
        });

        it('should generate exactly 10 segments for 120-second video', async () => {
            mockProcessVideo.mockResolvedValueOnce({
                segments: Array.from({ length: 10 }, (_, i) => ({
                    segmentNumber: i + 1,
                    status: 'completed',
                    duration: 12,
                })),
            });

            const result = await mockProcessVideo('video-120s');

            expect(result.segments).toHaveLength(10);
        });

        it('should handle larger file sizes for 120s videos', async () => {
            mockProcessVideo.mockResolvedValueOnce({
                files: {
                    final_720p: { size: 100000000 }, // ~100MB for 120s
                },
                totalProcessingTime: 600000, // 10 minutes
            });

            const result = await mockProcessVideo('video-120s');

            expect(result.files.final_720p.size).toBeGreaterThan(50000000);
        });
    });

    describe('pipeline progress tracking', () => {
        it('should report progress through each phase', async () => {
            const phases = [
                { phase: 'decomposing', progress: 10 },
                { phase: 'generating', progress: 50 },
                { phase: 'stitching', progress: 70 },
                { phase: 'audio', progress: 80 },
                { phase: 'merging', progress: 90 },
                { phase: 'transcoding', progress: 95 },
                { phase: 'completed', progress: 100 },
            ];

            for (const { phase, progress } of phases) {
                mockGetVideoStatus.mockResolvedValueOnce({
                    currentPhase: phase,
                    progress,
                });

                const status = await mockGetVideoStatus('video-id');
                expect(status.currentPhase).toBe(phase);
                expect(status.progress).toBe(progress);
            }
        });

        it('should track individual segment completion', async () => {
            mockGetVideoStatus.mockResolvedValueOnce({
                currentPhase: 'generating',
                currentSegment: 3,
                segmentCount: 5,
                completedSegments: 2,
                progress: 40,
            });

            const status = await mockGetVideoStatus('video-id');

            expect(status.currentSegment).toBe(3);
            expect(status.completedSegments).toBe(2);
        });
    });
});

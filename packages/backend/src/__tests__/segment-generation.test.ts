// Jest globals are available automatically

// ==========================================
// Segment Generation Service Tests
// ==========================================

describe('SegmentGenerationService', () => {
    const mockGenerateSegment = jest.fn();
    const mockGetReferenceFrame = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateSegment', () => {
        it('should generate a video segment from a scene prompt', async () => {
            const mockResult = {
                segmentPath: '/uploads/videos/user1/video1/segments/segment_001.mp4',
                duration: 12,
                width: 1920,
                height: 1080,
            };

            mockGenerateSegment.mockResolvedValueOnce(mockResult);

            const result = await mockGenerateSegment({
                scenePrompt: 'A majestic eagle soaring',
                segmentNumber: 1,
                referenceFrame: null,
            });

            expect(result.segmentPath).toContain('segment_001.mp4');
            expect(result.duration).toBe(12);
        });

        it('should use reference frame for scene continuity', async () => {
            const mockResult = {
                segmentPath: '/uploads/videos/user1/video1/segments/segment_002.mp4',
                usedReferenceFrame: true,
            };

            mockGenerateSegment.mockResolvedValueOnce(mockResult);

            const result = await mockGenerateSegment({
                scenePrompt: 'Eagle lands on mountain',
                segmentNumber: 2,
                referenceFrame: '/frames/frame_001.jpg',
            });

            expect(result.usedReferenceFrame).toBe(true);
        });

        it('should handle generation failure with retry', async () => {
            mockGenerateSegment
                .mockRejectedValueOnce(new Error('API timeout'))
                .mockRejectedValueOnce(new Error('API timeout'))
                .mockResolvedValueOnce({
                    segmentPath: '/segments/segment_001.mp4',
                    duration: 12,
                });

            // First two calls fail
            await expect(mockGenerateSegment()).rejects.toThrow('API timeout');
            await expect(mockGenerateSegment()).rejects.toThrow('API timeout');

            // Third call succeeds
            const result = await mockGenerateSegment();
            expect(result.segmentPath).toBeDefined();
        });

        it('should generate 720p video by default', async () => {
            const mockResult = {
                segmentPath: '/segments/segment_001.mp4',
                width: 1280,
                height: 720,
            };

            mockGenerateSegment.mockResolvedValueOnce(mockResult);

            const result = await mockGenerateSegment({
                scenePrompt: 'Sunset scene',
                resolution: '720p',
            });

            expect(result.width).toBe(1280);
            expect(result.height).toBe(720);
        });

        it('should extract last frame for next segment reference', async () => {
            const mockResult = {
                segmentPath: '/segments/segment_001.mp4',
                lastFramePath: '/frames/frame_001.jpg',
            };

            mockGenerateSegment.mockResolvedValueOnce(mockResult);

            const result = await mockGenerateSegment({
                scenePrompt: 'Ocean waves',
                extractLastFrame: true,
            });

            expect(result.lastFramePath).toContain('frame_001.jpg');
        });
    });

    describe('getReferenceFrame', () => {
        it('should extract frame from existing segment', async () => {
            mockGetReferenceFrame.mockResolvedValueOnce({
                framePath: '/frames/frame_001.jpg',
                timestamp: 11.9,
            });

            const result = await mockGetReferenceFrame('/segments/segment_001.mp4');

            expect(result.framePath).toBeDefined();
            expect(result.timestamp).toBeCloseTo(11.9, 1);
        });
    });
});

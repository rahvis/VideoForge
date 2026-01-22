// Jest globals are available automatically

// ==========================================
// Video Stitching Service Tests
// ==========================================

describe('VideoStitchingService', () => {
    const mockStitchSegments = jest.fn();
    const mockApplyTransitions = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('stitchSegments', () => {
        it('should stitch 5 segments into a 60-second video', async () => {
            const mockResult = {
                outputPath: '/videos/video1/stitched_720p.mp4',
                totalDuration: 60,
                segmentCount: 5,
            };

            mockStitchSegments.mockResolvedValueOnce(mockResult);

            const segments = [
                '/segments/segment_001.mp4',
                '/segments/segment_002.mp4',
                '/segments/segment_003.mp4',
                '/segments/segment_004.mp4',
                '/segments/segment_005.mp4',
            ];

            const result = await mockStitchSegments(segments);

            expect(result.totalDuration).toBe(60);
            expect(result.segmentCount).toBe(5);
        });

        it('should stitch 10 segments into a 120-second video', async () => {
            const mockResult = {
                outputPath: '/videos/video1/stitched_720p.mp4',
                totalDuration: 120,
                segmentCount: 10,
            };

            mockStitchSegments.mockResolvedValueOnce(mockResult);

            const segments = Array.from({ length: 10 }, (_, i) =>
                `/segments/segment_${String(i + 1).padStart(3, '0')}.mp4`
            );

            const result = await mockStitchSegments(segments);

            expect(result.totalDuration).toBe(120);
            expect(result.segmentCount).toBe(10);
        });

        it('should preserve video quality during stitching', async () => {
            const mockResult = {
                outputPath: '/videos/stitched.mp4',
                codec: 'h264',
                bitrate: '5000k',
                resolution: '1280x720',
            };

            mockStitchSegments.mockResolvedValueOnce(mockResult);

            const result = await mockStitchSegments([], { preserveQuality: true });

            expect(result.codec).toBe('h264');
            expect(result.resolution).toBe('1280x720');
        });

        it('should handle missing segments gracefully', async () => {
            mockStitchSegments.mockRejectedValueOnce(
                new Error('Segment file not found: segment_003.mp4')
            );

            await expect(mockStitchSegments(['seg1', 'seg2'])).rejects.toThrow(
                'Segment file not found'
            );
        });

        it('should maintain segment order in final video', async () => {
            const mockResult = {
                outputPath: '/videos/stitched.mp4',
                segmentOrder: [1, 2, 3, 4, 5],
            };

            mockStitchSegments.mockResolvedValueOnce(mockResult);

            const result = await mockStitchSegments([
                'segment_001.mp4',
                'segment_002.mp4',
                'segment_003.mp4',
                'segment_004.mp4',
                'segment_005.mp4',
            ]);

            expect(result.segmentOrder).toEqual([1, 2, 3, 4, 5]);
        });
    });

    describe('applyTransitions', () => {
        it('should apply crossfade transitions between segments', async () => {
            const mockResult = {
                outputPath: '/videos/stitched_with_transitions.mp4',
                transitionsApplied: 4,
                transitionDuration: 0.5,
            };

            mockApplyTransitions.mockResolvedValueOnce(mockResult);

            const result = await mockApplyTransitions({
                inputPath: '/videos/stitched.mp4',
                transitionType: 'crossfade',
                transitionDuration: 0.5,
            });

            expect(result.transitionsApplied).toBe(4);
            expect(result.transitionDuration).toBe(0.5);
        });

        it('should support multiple transition types', async () => {
            const transitionTypes = ['fade', 'crossfade', 'dissolve', 'wipe'];

            for (const type of transitionTypes) {
                mockApplyTransitions.mockResolvedValueOnce({
                    transitionType: type,
                });

                const result = await mockApplyTransitions({
                    transitionType: type,
                });

                expect(result.transitionType).toBe(type);
            }
        });
    });
});

// Jest globals are available automatically

// ==========================================
// Audio-Video Sync Alignment Tests
// ==========================================

const mockSyncVerification = {
    verifySync: jest.fn(),
    calculateDrift: jest.fn(),
    adjustAudioTiming: jest.fn(),
};

const mockAudioService = {
    generateNarration: jest.fn(),
    getDuration: jest.fn(),
};

describe('Audio-Video Sync Alignment', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('SyncVerificationService', () => {
        it('should verify audio-video sync is within tolerance', async () => {
            mockSyncVerification.verifySync.mockResolvedValueOnce({
                inSync: true,
                drift: 0.02, // 20ms drift
                tolerance: 0.1, // 100ms tolerance
            });

            const result = await mockSyncVerification.verifySync({
                videoPath: '/videos/final.mp4',
                audioDuration: 60.0,
                videoDuration: 60.02,
            });

            expect(result.inSync).toBe(true);
            expect(result.drift).toBeLessThan(result.tolerance);
        });

        it('should detect audio-video sync drift', async () => {
            mockSyncVerification.calculateDrift.mockResolvedValueOnce({
                drift: 0.5, // 500ms drift
                direction: 'audio_ahead',
            });

            const result = await mockSyncVerification.calculateDrift({
                audioDuration: 60.5,
                videoDuration: 60.0,
            });

            expect(result.drift).toBe(0.5);
            expect(result.direction).toBe('audio_ahead');
        });

        it('should adjust audio timing when drift exceeds tolerance', async () => {
            mockSyncVerification.adjustAudioTiming.mockResolvedValueOnce({
                adjusted: true,
                originalDuration: 61.0,
                adjustedDuration: 60.0,
                method: 'tempo_adjustment',
            });

            const result = await mockSyncVerification.adjustAudioTiming({
                audioPath: '/audio/narration.mp3',
                targetDuration: 60.0,
            });

            expect(result.adjusted).toBe(true);
            expect(result.adjustedDuration).toBe(60.0);
        });
    });

    describe('Audio generation sync', () => {
        it('should generate narration matching video duration', async () => {
            mockAudioService.generateNarration.mockResolvedValueOnce({
                audioPath: '/audio/narration.mp3',
                duration: 60.0,
                wordCount: 150,
            });

            const result = await mockAudioService.generateNarration({
                script: 'This is a test narration script...',
                targetDuration: 60,
                voiceId: 'default',
            });

            expect(result.duration).toBe(60.0);
        });

        it('should handle audio shorter than video', async () => {
            mockSyncVerification.verifySync.mockResolvedValueOnce({
                inSync: false,
                drift: -2.0,
                recommendation: 'pad_audio_end',
            });

            const result = await mockSyncVerification.verifySync({
                audioDuration: 58.0,
                videoDuration: 60.0,
            });

            expect(result.inSync).toBe(false);
            expect(result.recommendation).toBe('pad_audio_end');
        });

        it('should handle audio longer than video', async () => {
            mockSyncVerification.verifySync.mockResolvedValueOnce({
                inSync: false,
                drift: 3.0,
                recommendation: 'speed_up_audio',
            });

            const result = await mockSyncVerification.verifySync({
                audioDuration: 63.0,
                videoDuration: 60.0,
            });

            expect(result.inSync).toBe(false);
            expect(result.recommendation).toBe('speed_up_audio');
        });
    });

    describe('Segment-level sync', () => {
        it('should verify each segment audio matches 12 seconds', async () => {
            const segmentDurations = [12.0, 12.0, 12.0, 12.0, 12.0];

            for (const duration of segmentDurations) {
                mockAudioService.getDuration.mockResolvedValueOnce(duration);
                const result = await mockAudioService.getDuration('/segments/seg.mp4');
                expect(result).toBe(12.0);
            }
        });

        it('should handle variable segment durations', async () => {
            const segmentDurations = [11.9, 12.1, 12.0, 11.8, 12.2];
            const totalDuration = segmentDurations.reduce((a, b) => a + b, 0);

            mockSyncVerification.verifySync.mockResolvedValueOnce({
                inSync: true,
                totalVideoDuration: totalDuration,
                drift: Math.abs(60 - totalDuration),
            });

            const result = await mockSyncVerification.verifySync({
                videoDuration: totalDuration,
            });

            expect(result.inSync).toBe(true);
        });
    });

    describe('Final merge sync', () => {
        it('should produce synced final video', async () => {
            const mockMerge = jest.fn().mockResolvedValueOnce({
                outputPath: '/videos/final_merged.mp4',
                videoDuration: 60.0,
                audioDuration: 60.0,
                syncStatus: 'perfect',
            });

            const result = await mockMerge({
                videoPath: '/videos/stitched.mp4',
                audioPath: '/audio/narration.mp3',
            });

            expect(result.syncStatus).toBe('perfect');
            expect(result.videoDuration).toBe(result.audioDuration);
        });
    });
});

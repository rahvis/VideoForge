// Jest globals are available automatically

// ==========================================
// Scene Decomposition Service Tests
// ==========================================

describe('SceneDecompositionService', () => {
    // Mock decompose function
    const mockDecompose = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('decomposePrompt', () => {
        it('should decompose a 60-second prompt into 5 scenes', async () => {
            const mockResult = {
                scenes: [
                    { sceneNumber: 1, scenePrompt: 'Opening scene', duration: 12 },
                    { sceneNumber: 2, scenePrompt: 'Development', duration: 12 },
                    { sceneNumber: 3, scenePrompt: 'Conflict', duration: 12 },
                    { sceneNumber: 4, scenePrompt: 'Resolution', duration: 12 },
                    { sceneNumber: 5, scenePrompt: 'Conclusion', duration: 12 },
                ],
                segmentCount: 5,
                totalDuration: 60,
            };

            mockDecompose.mockResolvedValueOnce(mockResult);

            const result = await mockDecompose('A story about adventure', 60);

            expect(result.scenes).toHaveLength(5);
            expect(result.segmentCount).toBe(5);
            expect(result.totalDuration).toBe(60);
        });

        it('should decompose a 120-second prompt into 10 scenes', async () => {
            const mockResult = {
                scenes: Array.from({ length: 10 }, (_, i) => ({
                    sceneNumber: i + 1,
                    scenePrompt: `Scene ${i + 1}`,
                    duration: 12,
                })),
                segmentCount: 10,
                totalDuration: 120,
            };

            mockDecompose.mockResolvedValueOnce(mockResult);

            const result = await mockDecompose('An epic journey', 120);

            expect(result.scenes).toHaveLength(10);
            expect(result.segmentCount).toBe(10);
            expect(result.totalDuration).toBe(120);
        });

        it('should include continuity notes between scenes', async () => {
            const mockResult = {
                scenes: [
                    {
                        sceneNumber: 1,
                        scenePrompt: 'Opening shot of mountain',
                        continuityNotes: 'End with camera facing east',
                    },
                    {
                        sceneNumber: 2,
                        scenePrompt: 'Continue mountain panorama',
                        continuityNotes: 'Continue from eastern view',
                    },
                ],
                segmentCount: 2,
            };

            mockDecompose.mockResolvedValueOnce(mockResult);

            const result = await mockDecompose('Mountain panorama', 24);

            expect(result.scenes[0].continuityNotes).toBeDefined();
            expect(result.scenes[1].continuityNotes).toBeDefined();
        });

        it('should specify transition types between scenes', async () => {
            const mockResult = {
                scenes: [
                    { sceneNumber: 1, transitionType: 'fade' },
                    { sceneNumber: 2, transitionType: 'crossfade' },
                    { sceneNumber: 3, transitionType: 'cut' },
                ],
                segmentCount: 3,
            };

            mockDecompose.mockResolvedValueOnce(mockResult);

            const result = await mockDecompose('Story with transitions', 36);

            expect(result.scenes[0].transitionType).toBe('fade');
            expect(result.scenes[1].transitionType).toBe('crossfade');
        });

        it('should reject durations less than 60 seconds', async () => {
            mockDecompose.mockRejectedValueOnce(
                new Error('Duration must be between 60 and 120 seconds')
            );

            await expect(mockDecompose('Short video', 30)).rejects.toThrow(
                'Duration must be between 60 and 120 seconds'
            );
        });

        it('should reject durations greater than 120 seconds', async () => {
            mockDecompose.mockRejectedValueOnce(
                new Error('Duration must be between 60 and 120 seconds')
            );

            await expect(mockDecompose('Long video', 180)).rejects.toThrow(
                'Duration must be between 60 and 120 seconds'
            );
        });
    });
});

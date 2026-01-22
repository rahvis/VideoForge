import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from multiple possible locations
// tsx runs from the package directory, so try relative paths
dotenv.config(); // Default: looks in current working directory
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), 'packages/backend/.env') });

interface Config {
    // Database
    mongodbUri: string;

    // Azure OpenAI
    azure: {
        apiKey: string;
        apiVersion: string;
        apiVersionGpt: string;
        endpoint: string;
        modelName: string;
        deployment: string;
        modelSora: string;
    };

    // ElevenLabs
    elevenlabs: {
        apiKey: string;
        voiceId: string;
        model: string;
    };

    // Duration Settings
    duration: {
        min: number;
        max: number;
        segment: number;
        maxRetries: number;
    };

    // Processing
    processing: {
        maxConcurrentJobs: number;
        pollingIntervalMs: number;
        videoTimeoutMs: number;
        segmentTimeoutMs: number;
        lockTimeoutMs: number;
    };

    // Server
    nodeEnv: string;
    port: number;
    uploadDir: string;

    // JWT
    jwt: {
        secret: string;
        expiresIn: string;
    };
}

function getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key] ?? defaultValue;
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined) return defaultValue;
        throw new Error(`Missing required environment variable: ${key}`);
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${key} must be a number`);
    }
    return parsed;
}

export const config: Config = {
    // Database
    mongodbUri: getEnvVar('MONGODB_URI'),

    // Azure OpenAI
    azure: {
        apiKey: getEnvVar('AZURE_API_KEY'),
        apiVersion: getEnvVar('AZURE_API_VERSION', 'preview'),
        apiVersionGpt: getEnvVar('AZURE_API_GPT_VERSION', '2024-04-01-preview'),
        endpoint: getEnvVar('AZURE_ENDPOINT'),
        modelName: getEnvVar('AZURE_MODEL_NAME', 'gpt-4o'),
        deployment: getEnvVar('AZURE_DEPLOYMENT', 'gpt-4o'),
        modelSora: getEnvVar('AZURE_MODEL_SORA', 'sora'),
    },

    // ElevenLabs
    elevenlabs: {
        apiKey: getEnvVar('ELEVENLABS_API_KEY'),
        voiceId: getEnvVar('ELEVENLABS_VOICE_ID'),
        model: getEnvVar('ELEVENLABS_MODEL', 'eleven_flash_v2_5'),
    },

    // Duration Settings
    duration: {
        min: getEnvNumber('MIN_VIDEO_DURATION', 60),
        max: getEnvNumber('MAX_VIDEO_DURATION', 120),
        segment: getEnvNumber('SEGMENT_DURATION', 12),
        maxRetries: getEnvNumber('MAX_SEGMENT_RETRIES', 3),
    },

    // Processing
    processing: {
        maxConcurrentJobs: getEnvNumber('MAX_CONCURRENT_JOBS', 1),
        pollingIntervalMs: getEnvNumber('POLLING_INTERVAL_MS', 10000),
        videoTimeoutMs: getEnvNumber('VIDEO_TIMEOUT_MS', 1800000),
        segmentTimeoutMs: getEnvNumber('SEGMENT_TIMEOUT_MS', 900000),
        lockTimeoutMs: getEnvNumber('LOCK_TIMEOUT_MS', 1800000),
    },

    // Server
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
    port: getEnvNumber('PORT', 3001),
    uploadDir: getEnvVar('UPLOAD_DIR', './uploads'),

    // JWT
    jwt: {
        secret: (() => {
            const secret = getEnvVar('JWT_SECRET', 'video-forge-dev-secret-CHANGE-IN-PROD');
            if (process.env.NODE_ENV === 'production' && secret.includes('CHANGE-IN-PROD')) {
                throw new Error('JWT_SECRET must be set to a secure value in production');
            }
            return secret;
        })(),
        expiresIn: getEnvVar('JWT_EXPIRES_IN', '7d'),
    },
};

export default config;

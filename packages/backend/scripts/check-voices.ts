import { config } from '../src/config/index.js';

async function listVoices() {
    try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
                'xi-api-key': config.elevenlabs.apiKey
            }
        });

        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            console.error(await response.text());
            return;
        }

        const data = await response.json();
        console.log('Available Voices:');
        data.voices.forEach(v => console.log(`- ${v.name} (${v.voice_id})`));

        const configuredVoice = config.elevenlabs.voiceId;
        const found = data.voices.find(v => v.voice_id === configuredVoice);

        console.log('\n-------------------');
        if (found) {
            console.log(`✅ Configured voice '${configuredVoice}' FOUND: ${found.name}`);
        } else {
            console.log(`❌ Configured voice '${configuredVoice}' NOT FOUND in list.`);
        }

    } catch (error) {
        console.error(error);
    }
}

listVoices();

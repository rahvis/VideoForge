import { config } from '../src/config/index.js';

const JOB_ID = 'task_01ke483kkjedtbjfencj0z3b8a';

async function checkSoraJob() {
    const url = `${config.azure.endpoint}openai/v1/video/generations/jobs/${JOB_ID}?api-version=${config.azure.apiVersion}`;

    console.log('Checking Sora job:', JOB_ID);
    console.log('URL:', url);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Api-key': config.azure.apiKey,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error:', response.status, errorText);
            return;
        }

        const result = await response.json();
        console.log('\nJob Status:');
        console.log(JSON.stringify(result, null, 2));

        if (result.status === 'succeeded' && result.generations?.length > 0) {
            console.log('\n✅ Video URL can be downloaded from:');
            const generationId = result.generations[0].id;
            const contentUrl = `${config.azure.endpoint}openai/v1/video/generations/${generationId}/content/video?api-version=${config.azure.apiVersion}`;
            console.log(contentUrl);
        }
    } catch (error: any) {
        console.error('Fetch error:', error.message);
    }
}

checkSoraJob();

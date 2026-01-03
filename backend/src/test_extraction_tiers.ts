import { YouTubeTranscriptService } from './services/youtubeTranscript.service';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const videoId = process.argv[2];

if (!videoId) {
    console.error('Please provide a Video ID or URL as an argument');
    process.exit(1);
}

async function test() {
    let id = videoId;
    if (videoId.includes('youtube.com') || videoId.includes('youtu.be')) {
        id = YouTubeTranscriptService.extractVideoId(videoId) || videoId;
    }

    console.log(`\n🚀 Testing 3-Tier Extraction for Video ID: ${id}`);
    console.log('---------------------------------------------------\n');

    try {
        const result = await YouTubeTranscriptService.fetchVideoData(id);
        
        console.log('\n---------------------------------------------------');
        console.log('Final Extraction Result:');
        console.log(`- Method: ${result.extractionMethod || 'NONE (Tier 3 Fallback)'}`);
        console.log(`- Title: ${result.title}`);
        console.log(`- Author: ${result.author}`);
        console.log(`- Transcript length: ${result.transcript?.length || 0} chars`);
        console.log(`- Description length: ${result.description?.length || 0} chars`);
        console.log('---------------------------------------------------\n');
        
        if (!result.transcript) {
            console.log('ℹ️ No transcript found. ContentProcessor would trigger Gemini Vision Tier 3.');
        }
    } catch (error: any) {
        console.error('Test Failed:', error.message);
    }
}

test();


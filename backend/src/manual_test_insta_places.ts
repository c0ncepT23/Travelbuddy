import { ContentProcessorService } from './services/contentProcessor.service';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = process.argv[2];

if (!url) {
    console.error('Please provide a URL as an argument');
    process.exit(1);
}

async function run() {
    console.log(`Testing Instagram Multi-Place Extraction for: ${url}`);
    
    try {
        // First, let's peek at what the fetcher actually sees (calling private method workaround or just trust the logs)
        // We can't call private method easily, but ContentProcessorService logs "Fetched Instagram content"
        
        const result = await ContentProcessorService.extractMultiplePlacesFromInstagram(url);
        
        console.log('\n---------------------------------------------------');
        console.log('SUMMARY:');
        console.log(result.summary);
        console.log('---------------------------------------------------');
        console.log(`FOUND ${result.places.length} PLACES:`);
        console.log('---------------------------------------------------');
        
        result.places.forEach((place, index) => {
            console.log(`${index + 1}. ${place.name} (${place.category})`);
            console.log(`   Location: ${place.location_name || 'N/A'}`);
            console.log(`   Description: ${place.description}`);
            console.log('');
        });
        
    } catch (error: any) {
        console.error('Error processing Instagram post:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
        }
    }
}

run();


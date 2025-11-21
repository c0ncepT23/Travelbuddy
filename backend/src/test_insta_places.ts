import { ContentProcessorService } from './services/contentProcessor.service';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = 'https://www.instagram.com/p/DRCTL-jEnKF/';

async function run() {
    console.log(`Testing Instagram Place Extraction for: ${url}`);
    
    try {
        console.log('Calling extractMultiplePlacesFromInstagram...');
        const result = await ContentProcessorService.extractMultiplePlacesFromInstagram(url);
        
        console.log('\n---------------------------------------------------');
        console.log('SUMMARY:', result.summary);
        console.log('---------------------------------------------------');
        
        if (result.places.length === 0) {
            console.log('No specific places found.');
        } else {
            console.log(`Found ${result.places.length} places:\n`);
            result.places.forEach((place, index) => {
                console.log(`${index + 1}. ${place.name}`);
                console.log(`   Category: ${place.category}`);
                console.log(`   Location: ${place.location_name || 'N/A'}`);
                console.log(`   Description: ${place.description}`);
                console.log('');
            });
        }
        console.log('---------------------------------------------------');
        
    } catch (error: any) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

run();


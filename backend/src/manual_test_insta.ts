import { ContentProcessorService } from './services/contentProcessor.service';
import * as dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

// Load environment variables from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = process.argv[2];

if (!url) {
    console.error('Please provide a URL as an argument');
    process.exit(1);
}

async function run() {
    console.log(`Processing URL: ${url}`);
    console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
    console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);

    try {
        const result = await ContentProcessorService.processUrl(url);
        console.log('---------------------------------------------------');
        console.log('Processing Result:');
        console.log(JSON.stringify(result, null, 2));
        fs.writeFileSync('success.json', JSON.stringify(result, null, 2));
        console.log('Result written to success.json');
        console.log('---------------------------------------------------');
    } catch (error: any) {
        const errorMsg = `Error Message: ${error.message}\nError Stack: ${error.stack}\nResponse Status: ${error.response?.status}\nResponse Data: ${JSON.stringify(error.response?.data)}`;
        fs.writeFileSync('error.txt', errorMsg);
        console.error('Error written to error.txt');
    }
}

run();

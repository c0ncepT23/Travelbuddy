import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Innertube } from 'youtubei.js';

const GOOGLE_MAPS_API_KEY = 'AIzaSyAiWhzrvdNb2NKSyzWpvNrhImz72I395Qo';
const GEMINI_API_KEY = 'AIzaSyDEgFE6dw4WLYBDezSXdpDMS_MpkANX-Ks';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Step 1: Extract YouTube transcript
async function extractTranscript(videoUrl: string) {
  try {
    const videoId = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([^&]+)/)?.[1];
    if (!videoId) throw new Error('Invalid YouTube URL');

    console.log(`\n📹 Fetching video info for: ${videoId}`);
    
    const youtube = await Innertube.create();
    const videoInfo = await youtube.getInfo(videoId);
    
    const title = videoInfo.basic_info.title || 'Unknown';
    const description = videoInfo.basic_info.short_description || '';
    
    console.log(`✅ Video: ${title}`);
    
    // Get transcript
    const transcriptData = await videoInfo.getTranscript();
    const segments = transcriptData?.transcript?.content?.body?.initial_segments || [];
    
    const transcript = segments
      .map((segment: any) => segment.snippet?.text || '')
      .filter(Boolean)
      .join(' ');
    
    console.log(`✅ Transcript extracted: ${transcript.length} characters`);
    
    return { title, description, transcript };
  } catch (error: any) {
    console.error(`❌ Error extracting transcript: ${error.message}`);
    throw error;
  }
}

// Step 2: Use Gemini to extract places
async function extractPlaces(title: string, description: string, transcript: string) {
  try {
    console.log(`\n🤖 Analyzing with Gemini AI...`);
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
    const contentToAnalyze = transcript && transcript.length > 0 
      ? `Transcript:\n${transcript.substring(0, 15000)}`
      : `Description:\n${description}`;

    const prompt = `Analyze this YouTube travel video and extract relevant information.

Title: ${title}

${contentToAnalyze}

STEP 1 - CLASSIFY VIDEO TYPE:
Determine if this is a:
- **PLACES VIDEO**: Recommends specific restaurants, shops, attractions, hotels, or locations to visit
- **HOW-TO VIDEO**: Teaches how to do something without recommending specific places

STEP 2 - EXTRACT INFORMATION:

If PLACES VIDEO:
- Extract ALL specific place names, restaurants, shops, attractions mentioned
- Include name, category, description, location for EACH place

If HOW-TO VIDEO:
- Return empty places array

RESPOND ONLY WITH VALID JSON (no markdown, no extra text):
{
  "video_type": "places" or "howto",
  "summary": "Brief summary",
  "places": [
    {
      "name": "Place Name",
      "category": "food|accommodation|place|shopping|activity|tip",
      "description": "Specific details",
      "location": "City/Area"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse Gemini response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    console.log(`✅ Video type: ${parsed.video_type}`);
    console.log(`✅ Gemini extracted ${parsed.places?.length || 0} places`);
    
    return parsed.places || [];
  } catch (error: any) {
    console.error(`❌ Error with Gemini: ${error.message}`);
    throw error;
  }
}

// Step 3: Geocode places
async function geocodePlace(placeName: string, locationContext?: string) {
  try {
    const searchQuery = locationContext
      ? `${placeName}, ${locationContext}`
      : placeName;

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address: searchQuery,
          key: GOOGLE_MAPS_API_KEY,
        },
      }
    );

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      const location = result.geometry.location;

      return {
        lat: location.lat,
        lng: location.lng,
        formatted_address: result.formatted_address,
      };
    }
    
    return null;
  } catch (error: any) {
    console.error(`❌ Geocoding error: ${error.message}`);
    return null;
  }
}

// Main test function
async function testFullPipeline(videoUrl: string) {
  console.log('🎬 FULL PIPELINE TEST - YouTube → Gemini → Geocoding');
  console.log('='.repeat(70));
  console.log(`Video: ${videoUrl}`);
  console.log('='.repeat(70));

  try {
    // Step 1: Extract transcript
    const { title, description, transcript } = await extractTranscript(videoUrl);
    
    // Step 2: Extract places with Gemini
    const places = await extractPlaces(title, description, transcript);
    
    if (places.length === 0) {
      console.log('\n⚠️  No places found in this video (might be a how-to video)');
      return;
    }
    
    // Step 3: Geocode each place
    console.log(`\n📍 Geocoding ${places.length} places...`);
    console.log('='.repeat(70));
    
    const results = [];
    
    for (const place of places) {
      console.log(`\n🔍 ${place.name} (${place.category})`);
      console.log(`   Location context: ${place.location || 'Not specified'}`);
      
      const coords = await geocodePlace(place.name, place.location);
      
      if (coords) {
        console.log(`   ✅ Found: (${coords.lat}, ${coords.lng})`);
        console.log(`   📍 ${coords.formatted_address}`);
        
        results.push({
          name: place.name,
          category: place.category,
          description: place.description,
          location: place.location,
          lat: coords.lat,
          lng: coords.lng,
          formatted_address: coords.formatted_address,
        });
      } else {
        console.log(`   ❌ Could not geocode`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(70));
    console.log(`Total places extracted: ${places.length}`);
    console.log(`Successfully geocoded: ${results.length}`);
    console.log(`Failed to geocode: ${places.length - results.length}`);
    
    if (results.length > 0) {
      console.log('\n📍 ALL PLACES WITH COORDINATES:');
      console.log('='.repeat(70));
      
      results.forEach((place, index) => {
        console.log(`\n${index + 1}. ${place.name}`);
        console.log(`   Category: ${place.category}`);
        console.log(`   Description: ${place.description}`);
        console.log(`   Coordinates: (${place.lat}, ${place.lng})`);
        console.log(`   Address: ${place.formatted_address}`);
      });
    }
    
    console.log('\n✅ Complete pipeline test finished!');
    console.log('These are exactly what would be saved to your database and shown on the map.');
    
  } catch (error: any) {
    console.error(`\n❌ Pipeline failed: ${error.message}`);
  }
}

// Run the test
const videoUrl = process.argv[2] || 'https://www.youtube.com/watch?v=VcuM9JvZrp4';
testFullPipeline(videoUrl).catch(console.error);


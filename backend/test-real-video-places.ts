import axios from 'axios';

const GOOGLE_MAPS_API_KEY = 'AIzaSyAiWhzrvdNb2NKSyzWpvNrhImz72I395Qo';

// ACTUAL places from the video: https://www.youtube.com/watch?v=q5PQvBL0XSI
const realPlaces = [
  { name: 'RAGTAG Ginza', location: 'Ginza, Tokyo' },
  { name: 'Brand Off', location: 'Ginza, Tokyo' },
  { name: 'Komehyo', location: 'Tokyo' },
  { name: 'Kahillo', location: 'Tokyo' },
  { name: 'Kahillo Vintage', location: 'Harajuku, Tokyo' },
  { name: 'Qoo Vintage', location: 'Harajuku, Tokyo' },
  { name: 'Amore Vintage', location: 'Harajuku, Tokyo' },
  { name: 'Second Street', location: 'Shinjuku, Tokyo' },
  { name: 'Brand Off', location: 'Kyoto' },
  { name: 'Vintage Store', location: 'Shibuya Mall, Tokyo' },
];

async function geocodePlace(placeName: string, locationContext?: string) {
  try {
    const searchQuery = locationContext
      ? `${placeName}, ${locationContext}`
      : placeName;

    console.log(`\n🔍 Searching for: "${searchQuery}"`);

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

      console.log(`✅ FOUND:`);
      console.log(`   Store: ${placeName}`);
      console.log(`   Latitude: ${location.lat}`);
      console.log(`   Longitude: ${location.lng}`);
      console.log(`   Full Address: ${result.formatted_address}`);
      
      return {
        name: placeName,
        lat: location.lat,
        lng: location.lng,
        formatted_address: result.formatted_address,
      };
    } else {
      console.log(`❌ NOT FOUND: ${response.data.status}`);
      return null;
    }
  } catch (error: any) {
    console.error(`❌ ERROR: ${error.message}`);
    return null;
  }
}

async function runTest() {
  console.log('🛍️  TESTING REAL VIDEO PLACES - Vintage Shopping Stores');
  console.log('=' .repeat(60));
  console.log('Video: https://www.youtube.com/watch?v=q5PQvBL0XSI');
  console.log(`Testing ${realPlaces.length} ACTUAL places from the video...`);
  console.log('=' .repeat(60));

  const results = [];

  for (const place of realPlaces) {
    const result = await geocodePlace(place.name, place.location);
    if (result) {
      results.push(result);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total places tested: ${realPlaces.length}`);
  console.log(`Successfully geocoded: ${results.length}`);
  console.log(`Failed: ${realPlaces.length - results.length}`);
  
  if (results.length > 0) {
    console.log('\n📍 ALL COORDINATES FOR VINTAGE STORES:');
    console.log('='.repeat(60));
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name}`);
      console.log(`   → (${result.lat}, ${result.lng})`);
      console.log(`   Address: ${result.formatted_address}`);
    });
  }
  
  console.log('\n✅ Geocoding test complete!');
  console.log('These are the ACTUAL coordinates that would be extracted from the video.');
}

runTest().catch(console.error);


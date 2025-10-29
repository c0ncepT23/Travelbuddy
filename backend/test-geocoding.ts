import axios from 'axios';

const GOOGLE_MAPS_API_KEY = 'AIzaSyAiWhzrvdNb2NKSyzWpvNrhImz72I395Qo';

// Example places that might be extracted from a Tokyo video
const testPlaces = [
  { name: 'Shibuya Crossing', location: 'Tokyo' },
  { name: 'Senso-ji Temple', location: 'Asakusa, Tokyo' },
  { name: 'Tokyo Skytree', location: 'Tokyo' },
  { name: 'Tsukiji Outer Market', location: 'Tokyo' },
  { name: 'Meiji Shrine', location: 'Harajuku, Tokyo' },
  { name: 'Teamlab Borderless', location: 'Odaiba, Tokyo' },
  { name: 'Ichiran Ramen', location: 'Shibuya, Tokyo' },
  { name: 'Don Quijote', location: 'Shibuya, Tokyo' },
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
      console.log(`   Place: ${placeName}`);
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
  console.log('🗺️  GEOCODING TEST SCRIPT');
  console.log('=' .repeat(60));
  console.log(`Testing ${testPlaces.length} example places from Tokyo...`);
  console.log('=' .repeat(60));

  const results = [];

  for (const place of testPlaces) {
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
  console.log(`Total places tested: ${testPlaces.length}`);
  console.log(`Successfully geocoded: ${results.length}`);
  console.log(`Failed: ${testPlaces.length - results.length}`);
  
  console.log('\n📍 ALL COORDINATES:');
  console.log('='.repeat(60));
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}`);
    console.log(`   → (${result.lat}, ${result.lng})`);
  });
  
  console.log('\n✅ Geocoding test complete!');
  console.log('These coordinates would be saved to the database and shown as map markers.');
}

runTest().catch(console.error);


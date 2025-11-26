/**
 * Direct database enrichment script
 * Run with: npx ts-node enrich-now.ts
 */

import { Pool } from 'pg';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();

// Your trip ID from Supabase
const TRIP_ID = 'bf8fbb5c-f39e-40cc-ad31-ce8b6d2aca70';

// Debug: Check if DATABASE_URL is loaded
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL not found in .env file!');
  console.log('Make sure your .env file exists and has DATABASE_URL set.');
  process.exit(1);
}

// Google Places API key (from your env)
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || 'AIzaSyAiWhzrvdNb2NKSyzWpvNrhImz72I395Qo';

// Database connection (uses DATABASE_URL from env)
// Try without SSL first - Supabase transaction pooler doesn't need it
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface PlaceDetails {
  place_id: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  formatted_address?: string;
  area_name?: string;
  photos?: any[];
  geometry?: { location: { lat: number; lng: number } };
}

async function searchPlace(name: string, locationHint?: string): Promise<string | null> {
  try {
    const query = locationHint ? `${name} ${locationHint}` : `${name} Japan`;
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query,
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0].place_id;
    }
    return null;
  } catch (error) {
    console.error(`Error searching for "${name}":`, error);
    return null;
  }
}

async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: {
        place_id: placeId,
        fields: 'place_id,name,formatted_address,rating,user_ratings_total,price_level,photos,geometry,address_components',
        key: GOOGLE_API_KEY,
      },
    });

    if (response.data.result) {
      const result = response.data.result;
      
      // Extract area name from address components
      let areaName = '';
      if (result.address_components) {
        const cityComponent = result.address_components.find((c: any) => 
          c.types.includes('locality') || 
          c.types.includes('sublocality_level_1') ||
          c.types.includes('administrative_area_level_2')
        );
        if (cityComponent) {
          areaName = cityComponent.long_name;
        }
      }

      return {
        place_id: result.place_id,
        rating: result.rating,
        user_ratings_total: result.user_ratings_total,
        price_level: result.price_level,
        formatted_address: result.formatted_address,
        area_name: areaName,
        photos: result.photos?.slice(0, 5),
        geometry: result.geometry,
      };
    }
    return null;
  } catch (error) {
    console.error(`Error getting details for place ${placeId}:`, error);
    return null;
  }
}

async function enrichPlaces() {
  console.log('🚀 Starting enrichment for trip:', TRIP_ID);
  console.log('');

  try {
    // Get all places that need enrichment
    const { rows: places } = await pool.query(`
      SELECT id, name, location_name, category
      FROM saved_items
      WHERE trip_group_id = $1
        AND google_place_id IS NULL
        AND category != 'tip'
      ORDER BY created_at DESC
    `, [TRIP_ID]);

    console.log(`📍 Found ${places.length} places to enrich`);
    console.log('');

    let enriched = 0;
    let skipped = 0;

    for (const place of places) {
      console.log(`Processing: ${place.name}...`);

      // Search for the place
      const placeId = await searchPlace(place.name, place.location_name);
      
      if (!placeId) {
        console.log(`  ⚠️ Could not find on Google Maps`);
        skipped++;
        continue;
      }

      // Get details
      const details = await getPlaceDetails(placeId);
      
      if (!details) {
        console.log(`  ⚠️ Could not get details`);
        skipped++;
        continue;
      }

      // Update the database
      await pool.query(`
        UPDATE saved_items
        SET 
          google_place_id = $1,
          rating = $2,
          user_ratings_total = $3,
          price_level = $4,
          formatted_address = $5,
          area_name = $6,
          photos_json = $7,
          location_lat = COALESCE($8, location_lat),
          location_lng = COALESCE($9, location_lng),
          updated_at = NOW()
        WHERE id = $10
      `, [
        details.place_id,
        details.rating,
        details.user_ratings_total,
        details.price_level,
        details.formatted_address,
        details.area_name,
        JSON.stringify(details.photos || []),
        details.geometry?.location.lat,
        details.geometry?.location.lng,
        place.id,
      ]);

      console.log(`  ✅ Rating: ${details.rating || 'N/A'} ⭐ | Area: ${details.area_name || 'N/A'}`);
      enriched++;

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`✅ DONE!`);
    console.log(`   Enriched: ${enriched}`);
    console.log(`   Skipped:  ${skipped}`);
    console.log(`   Total:    ${places.length}`);
    console.log('═══════════════════════════════════════');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

// Run it
enrichPlaces();


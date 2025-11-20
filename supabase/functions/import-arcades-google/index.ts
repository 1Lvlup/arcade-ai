import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GooglePlacesResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  formatted_phone_number?: string;
  website?: string;
}

interface GooglePlaceDetailsResult {
  result: {
    website?: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
  };
  status: string;
}

interface GooglePlacesResponse {
  results: GooglePlacesResult[];
  status: string;
  error_message?: string;
}

function parseAddress(formattedAddress: string): { city?: string; state?: string; country?: string } {
  if (!formattedAddress) return {};
  
  // Split by comma and clean up
  const parts = formattedAddress.split(',').map(p => p.trim());
  
  // Most US addresses: "Street, City, State ZIP, Country"
  // Most addresses have at least 2 parts
  if (parts.length < 2) return {};
  
  const country = parts[parts.length - 1]; // Last part is usually country
  let state: string | undefined;
  let city: string | undefined;
  
  if (parts.length >= 3) {
    // Second to last is usually "State ZIP"
    const stateZipPart = parts[parts.length - 2];
    // Extract state code (first word before space or number)
    const stateMatch = stateZipPart.match(/^([A-Z]{2})/);
    state = stateMatch ? stateMatch[1] : stateZipPart.split(' ')[0];
    
    // Third from last is usually city
    city = parts[parts.length - 3];
  } else if (parts.length === 2) {
    city = parts[0];
  }
  
  return {
    city: city || undefined,
    state: state || undefined,
    country: country || undefined
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { location, radius_km = 50, max_results = 40 } = await req.json();

    if (!location) {
      return new Response(
        JSON.stringify({ error: 'location is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Google API key from environment
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!googleApiKey) {
      console.error('GOOGLE_PLACES_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Google API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build Google Places Text Search query
    const query = `arcade family entertainment center bowling laser tag near ${location}`;
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', query);
    url.searchParams.set('key', googleApiKey);

    console.log('Calling Google Places API for:', location);

    // Call Google Places API
    const googleResponse = await fetch(url.toString());
    const googleData: GooglePlacesResponse = await googleResponse.json();

    if (googleData.status !== 'OK' && googleData.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', googleData.status, googleData.error_message);
      return new Response(
        JSON.stringify({ error: `Google API error: ${googleData.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Process results
    const results = googleData.results.slice(0, max_results);
    let inserted = 0;
    let updated = 0;

    for (const place of results) {
      const { city, state, country } = parseAddress(place.formatted_address);

      // Fetch additional details (website, phone) from Place Details API
      let website = place.website || null;
      let phone = place.formatted_phone_number || null;

      try {
        const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
        detailsUrl.searchParams.set('place_id', place.place_id);
        detailsUrl.searchParams.set('fields', 'website,formatted_phone_number,international_phone_number');
        detailsUrl.searchParams.set('key', googleApiKey);

        const detailsResponse = await fetch(detailsUrl.toString());
        const detailsData: GooglePlaceDetailsResult = await detailsResponse.json();

        if (detailsData.status === 'OK' && detailsData.result) {
          website = detailsData.result.website || website;
          phone = detailsData.result.formatted_phone_number || detailsData.result.international_phone_number || phone;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (detailsError) {
        console.error(`Failed to fetch details for ${place.name}:`, detailsError);
        // Continue processing even if details fetch fails
      }

      const prospectData = {
        place_id: place.place_id,
        name: place.name,
        formatted_address: place.formatted_address,
        city,
        state,
        country,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        phone_number: phone,
        website: website,
        google_rating: place.rating || null,
        user_ratings_total: place.user_ratings_total || null,
        types: place.types || [],
        raw_payload: place,
      };

      // Check if prospect already exists
      const { data: existing } = await supabase
        .from('prospects_google')
        .select('id, imported_to_companies')
        .eq('place_id', place.place_id)
        .single();

      if (existing) {
        // Update existing (but don't change imported_to_companies)
        await supabase
          .from('prospects_google')
          .update({
            ...prospectData,
            imported_to_companies: existing.imported_to_companies, // Keep existing value
          })
          .eq('place_id', place.place_id);
        updated++;
      } else {
        // Insert new
        await supabase
          .from('prospects_google')
          .insert({ ...prospectData, imported_to_companies: false });
        inserted++;
      }
    }

    console.log(`Processed ${results.length} places: ${inserted} inserted, ${updated} updated`);

    return new Response(
      JSON.stringify({
        status: 'ok',
        location,
        radius_km,
        inserted,
        updated,
        total_processed: results.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in import-arcades-google:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

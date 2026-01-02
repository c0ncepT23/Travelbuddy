import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get('tripId');

    if (!tripId) {
      return new Response('Missing tripId', { status: 400 });
    }

    // 1. Fetch Trip Data from Backend
    // In production, this would be your Railway/Production URL
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/api/public/trips/${tripId}/summary`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch trip data');
    }

    const { data } = await response.json();
    const { title, country, photoUrls, memoryCount, mascotType } = data;

    // 2. Render the Polaroid Collage
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0F1115',
            position: 'relative',
          }}
        >
          {/* Background Grid Pattern */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1, backgroundImage: 'radial-gradient(#7FFF00 1px, transparent 0)', backgroundSize: '40px 40px' }} />

          {/* THE POLAROID STACK */}
          <div style={{ display: 'flex', position: 'relative', width: '900px', height: '450px', alignItems: 'center', justifyContent: 'center' }}>
            
            {/* PHOTO 3 (Bottom) */}
            {photoUrls[2] && (
              <div style={{
                display: 'flex', position: 'absolute',
                transform: 'rotate(12deg) translate(180px, 30px)',
                background: '#1A1D23', padding: '12px 12px 48px 12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)', border: '1px solid #334155'
              }}>
                <img src={photoUrls[2]} width="280" height="280" style={{ objectFit: 'cover' }} />
              </div>
            )}

            {/* PHOTO 2 (Middle) */}
            {photoUrls[1] && (
              <div style={{
                display: 'flex', position: 'absolute',
                transform: 'rotate(-8deg) translate(-180px, -30px)',
                background: '#1A1D23', padding: '12px 12px 48px 12px',
                boxShadow: '0 15px 35px rgba(0,0,0,0.4)', border: '1px solid #334155'
              }}>
                <img src={photoUrls[1]} width="300" height="300" style={{ objectFit: 'cover' }} />
              </div>
            )}

            {/* PHOTO 1 (Top/Center) */}
            <div style={{
              display: 'flex', position: 'absolute',
              transform: 'rotate(2deg) translateY(-20px)',
              background: '#1A1D23', padding: '16px 16px 72px 16px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)', border: '1px solid #334155',
            }}>
              <img src={photoUrls[0] || 'https://yorisan.com/placeholder.png'} width="380" height="380" style={{ objectFit: 'cover' }} />
              {/* "Tape" Decoration */}
              <div style={{ position: 'absolute', top: -15, left: '50%', marginLeft: -50, width: 100, height: 35, background: 'rgba(127, 255, 0, 0.4)', transform: 'rotate(-3deg)' }} />
            </div>
          </div>

          {/* INFO BAR */}
          <div style={{
            display: 'flex', position: 'absolute', bottom: 40, width: '100%',
            padding: '0 80px', alignItems: 'flex-end', justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 64, fontWeight: 'bold', color: 'white' }}>{title}</span>
              <span style={{ fontSize: 28, color: '#94A3B8', marginTop: 5 }}>{memoryCount} Unforgettable Memories • {country}</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: 20, color: '#64748B', fontWeight: 'bold' }}>CREATED WITH</span>
                <span style={{ fontSize: 36, color: '#7FFF00', fontWeight: '900' }}>YORI</span>
              </div>
              <img src={`https://yorisan.com/mascot-${mascotType || 'happy'}.png`} width="110" height="110" />
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error(e);
    return new Response(`Failed to generate image`, { status: 500 });
  }
}


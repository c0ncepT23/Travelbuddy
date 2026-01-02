import { Metadata, ResolvingMetadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

async function getTripSummary(id: string) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  const response = await fetch(`${backendUrl}/api/public/trips/${id}/summary`, {
    next: { revalidate: 3600 } // Cache for 1 hour
  });
  
  if (!response.ok) return null;
  const { data } = await response.json();
  return data;
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const id = (await params).id;
  const trip = await getTripSummary(id);

  if (!trip) return { title: 'Yori - Travel Story' };

  const ogUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/og/journey`);
  ogUrl.searchParams.set('tripId', id);

  return {
    title: `${trip.title} - My Travel Story on Yori`,
    description: `Check out my ${trip.memoryCount} memories from ${trip.country}. Created with Yori - Your Travel Note Keeper.`,
    openGraph: {
      title: `${trip.title} - My Travel Story`,
      description: `Exploring ${trip.country} with Yori.`,
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: trip.title,
      description: `Exploring ${trip.country} with Yori.`,
      images: [ogUrl.toString()],
    },
  };
}

export default async function Page({ params }: Props) {
  const id = (await params).id;
  const trip = await getTripSummary(id);

  if (!trip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0F1115] p-6 text-center">
        <h1 className="text-2xl font-bold text-white">Story not found</h1>
        <p className="text-slate-400 mt-2">This travel story might be private or deleted.</p>
        <Link href="/" className="mt-6 px-8 py-3 bg-[#7FFF00] text-[#0F1115] rounded-full font-black">
          Go to Yori
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1115] flex flex-col font-sans overflow-x-hidden">
      {/* Hero Header */}
      <header className="bg-[#16191E] border-b border-slate-800 px-6 py-8 text-center sticky top-0 z-50 backdrop-blur-md bg-opacity-90">
        <div className="inline-block bg-[#7FFF00]/10 border border-[#7FFF00]/20 px-4 py-1 rounded-full text-[#7FFF00] text-[10px] font-black uppercase tracking-[0.2em] mb-4">
          Travel Story
        </div>
        <h1 className="text-3xl font-black text-white mb-1 tracking-tight">{trip.title}</h1>
        <p className="text-sm text-slate-400 font-medium mb-6">{trip.country} • {trip.memoryCount} Memories</p>
        
        {/* TOP CTA */}
        <Link 
          href="https://yorisan.com"
          className="inline-flex items-center gap-2 bg-[#7FFF00] text-[#0F1115] px-6 py-3 rounded-2xl font-black text-sm shadow-[0_0_20px_rgba(127,255,0,0.2)] hover:scale-105 transition-transform active:scale-95"
        >
          <span>Get Yori App</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
        </Link>
      </header>

      {/* Teaser Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-6 py-12 relative">
        <div className="space-y-16">
          {trip.photoUrls.map((url: string, index: number) => (
            <div 
              key={index}
              className={`relative bg-[#1A1D23] p-3 pb-12 shadow-2xl border border-slate-800 transform ${
                index % 2 === 0 ? 'rotate-1' : '-rotate-1'
              } max-w-[280px] mx-auto`}
            >
              <div className="aspect-square relative overflow-hidden rounded-sm bg-slate-900">
                <img 
                  src={url} 
                  alt={`Memory ${index + 1}`}
                  className="object-cover w-full h-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://yorisan.com/placeholder.png';
                  }}
                />
              </div>
              <div className="absolute bottom-4 left-4 right-4 h-3 bg-[#7FFF00] rounded-full opacity-5" />
            </div>
          ))}
        </div>

        {/* THE FEAR OF MISSING OUT (FOMO) BLUR */}
        <div className="absolute bottom-0 left-0 right-0 h-[500px] bg-gradient-to-t from-[#0F1115] via-[#0F1115]/98 to-transparent z-10 flex flex-col items-center justify-end pb-24 px-6">
          <div className="backdrop-blur-xl bg-[#1A1D23]/80 border border-slate-700/50 p-8 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center max-w-sm w-full">
             <div className="w-16 h-16 bg-[#7FFF00] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(127,255,0,0.3)] rotate-3">
                <span className="text-[#0F1115] text-3xl font-black italic">Y</span>
             </div>
             <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Unlock the Full Journey</h2>
             <p className="text-slate-400 mb-2 leading-relaxed font-medium text-sm">
               Vamsi has saved {trip.memoryCount - 3} more spots and notes on their personal map.
             </p>
             <p className="mt-4 text-[#7FFF00] text-[10px] font-black uppercase tracking-[0.2em]">
               Available for iOS & Android
             </p>
          </div>
        </div>
      </main>
    </div>
  );
}


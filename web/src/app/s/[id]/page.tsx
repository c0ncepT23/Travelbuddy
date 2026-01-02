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
    <div className="min-h-screen bg-[#0F1115] flex flex-col font-sans">
      {/* Hero Header */}
      <header className="bg-[#16191E] border-b border-slate-800 px-6 py-8 text-center">
        <div className="inline-block bg-[#7FFF00]/10 border border-[#7FFF00]/20 px-4 py-1 rounded-full text-[#7FFF00] text-xs font-black uppercase tracking-widest mb-4">
          Travel Story
        </div>
        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">{trip.title}</h1>
        <p className="text-lg text-slate-400 font-medium">{trip.country} • {trip.memoryCount} Memories</p>
      </header>

      {/* Teaser Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 relative">
        <div className="space-y-24">
          {trip.photoUrls.map((url: string, index: number) => (
            <div 
              key={index}
              className={`relative bg-[#1A1D23] p-4 pb-16 shadow-2xl border border-slate-800 transform ${
                index % 2 === 0 ? 'rotate-2' : '-rotate-2'
              }`}
            >
              <div className="aspect-square relative overflow-hidden rounded-sm bg-slate-900">
                <img 
                  src={url} 
                  alt={`Memory ${index + 1}`}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="absolute bottom-6 left-6 right-6 h-4 bg-[#7FFF00] rounded-full opacity-5" />
            </div>
          ))}
        </div>

        {/* THE FEAR OF MISSING OUT (FOMO) BLUR */}
        <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-[#0F1115] via-[#0F1115]/95 to-transparent z-10 flex flex-col items-center justify-end pb-20 px-6">
          <div className="backdrop-blur-xl bg-[#1A1D23]/80 border border-slate-700/50 p-8 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center max-w-sm w-full">
             <div className="w-16 h-16 bg-[#7FFF00] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(127,255,0,0.3)] rotate-3">
                <span className="text-[#0F1115] text-3xl font-black italic">Y</span>
             </div>
             <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Unlock the Full Journey</h2>
             <p className="text-slate-400 mb-8 leading-relaxed font-medium">
               Vamsi has saved {trip.memoryCount - 3} more spots and notes on their personal map.
             </p>
             <Link 
               href="https://play.google.com/store/apps/details?id=travel.yori.app"
               className="block w-full bg-[#7FFF00] text-[#0F1115] py-4 rounded-2xl font-black text-lg shadow-lg hover:scale-105 transition-transform active:scale-95"
             >
               Get Yori Free
             </Link>
             <p className="mt-4 text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">
               Available for iOS & Android
             </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 text-center text-slate-600">
        <p className="text-xs font-bold tracking-widest uppercase">MADE WITH LOVE BY YORI-SAN 🌏</p>
      </footer>
    </div>
  );
}


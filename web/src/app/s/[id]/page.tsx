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
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <h1 className="text-2xl font-bold text-slate-900">Story not found</h1>
        <p className="text-slate-600 mt-2">This travel story might be private or deleted.</p>
        <Link href="/" className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-full font-bold">
          Go to Yori
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Hero Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-8 text-center">
        <div className="inline-block bg-blue-100 px-4 py-1 rounded-full text-blue-600 text-xs font-black uppercase tracking-widest mb-4">
          Travel Story
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-2">{trip.title}</h1>
        <p className="text-lg text-slate-600 font-medium">{trip.country} • {trip.memoryCount} Memories</p>
      </header>

      {/* Teaser Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 relative">
        <div className="space-y-24">
          {trip.photoUrls.map((url: string, index: number) => (
            <div 
              key={index}
              className={`relative bg-white p-4 pb-16 shadow-xl transform ${
                index % 2 === 0 ? 'rotate-2' : '-rotate-2'
              }`}
            >
              <div className="aspect-square relative overflow-hidden rounded-sm bg-slate-100">
                <img 
                  src={url} 
                  alt={`Memory ${index + 1}`}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="absolute bottom-6 left-6 right-6 h-4 bg-slate-50 rounded-full opacity-20" />
            </div>
          ))}
        </div>

        {/* THE FEAR OF MISSING OUT (FOMO) BLUR */}
        <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent z-10 flex flex-col items-center justify-end pb-20 px-6">
          <div className="backdrop-blur-md bg-white/70 border border-white/50 p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full">
             <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3">
                <span className="text-white text-3xl font-black italic">Y</span>
             </div>
             <h2 className="text-2xl font-black text-slate-900 mb-3">Unlock the Full Journey</h2>
             <p className="text-slate-600 mb-8 leading-relaxed font-medium">
               Vamsi has saved {trip.memoryCount - 3} more spots and notes on their personal map.
             </p>
             <Link 
               href="https://play.google.com/store/apps/details?id=travel.yori.app"
               className="block w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-105 transition-transform active:scale-95"
             >
               Get Yori Free
             </Link>
             <p className="mt-4 text-slate-400 text-xs font-bold uppercase tracking-widest">
               Available on iOS & Android
             </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 text-center text-slate-400">
        <p className="text-sm font-bold tracking-tighter">MADE WITH LOVE BY YORI-SAN 🌏</p>
      </footer>
    </div>
  );
}


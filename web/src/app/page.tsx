import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] font-sans overflow-hidden relative">
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-400/10 rounded-full blur-[120px]" />

      <main className="z-10 flex flex-col items-center text-center px-6">
        {/* App Icon */}
        <div className="w-24 h-24 bg-blue-600 rounded-[32px] flex items-center justify-center mb-10 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
           <span className="text-white text-5xl font-black italic">Y</span>
        </div>

        <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter mb-6">
          Yori<span className="text-blue-600">.</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-500 font-medium max-w-xl mb-12 leading-relaxed">
          Your digital sanctuary for travel notes. 
          Capture memories, build your visual map, and share your story.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Link 
            href="https://play.google.com/store/apps/details?id=travel.yori.app"
            className="flex-1 bg-slate-900 text-white px-8 py-5 rounded-3xl font-black text-xl shadow-2xl hover:scale-105 transition-transform active:scale-95 flex items-center justify-center gap-3"
          >
            Get Yori Free
          </Link>
        </div>

        <p className="mt-8 text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">
          Available for iOS & Android
        </p>
      </main>

      {/* Floating Elements Teaser */}
      <div className="mt-20 flex gap-4 opacity-40 grayscale pointer-events-none select-none">
        <div className="w-40 h-52 bg-white rounded-2xl shadow-xl -rotate-6 border border-slate-100" />
        <div className="w-40 h-52 bg-white rounded-2xl shadow-xl rotate-3 border border-slate-100 hidden sm:block" />
        <div className="w-40 h-52 bg-white rounded-2xl shadow-xl -rotate-12 border border-slate-100 hidden md:block" />
      </div>

      <footer className="absolute bottom-10 text-slate-400 text-sm font-bold tracking-tighter">
        MADE WITH LOVE BY YORI-SAN 🌏
      </footer>
    </div>
  );
}

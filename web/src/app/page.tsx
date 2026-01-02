import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0F1115] font-sans overflow-hidden relative">
      {/* Decorative Blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#7FFF00]/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#06B6D4]/10 rounded-full blur-[120px]" />

      <main className="z-10 flex flex-col items-center text-center px-6">
        {/* App Icon */}
        <div className="w-24 h-24 bg-[#7FFF00] rounded-[32px] flex items-center justify-center mb-10 shadow-[0_0_40px_rgba(127,255,0,0.3)] rotate-3 hover:rotate-0 transition-transform duration-500">
           <span className="text-[#0F1115] text-5xl font-black italic">Y</span>
        </div>

        <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-6">
          Yori<span className="text-[#7FFF00]">.</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-slate-400 font-medium max-w-xl mb-12 leading-relaxed">
          Your digital sanctuary for travel notes. 
          Capture memories, build your visual map, and share your story.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Link 
            href="https://play.google.com/store/apps/details?id=travel.yori.app"
            className="flex-1 bg-[#7FFF00] text-[#0F1115] px-8 py-5 rounded-3xl font-black text-xl shadow-[0_0_30px_rgba(127,255,0,0.2)] hover:scale-105 transition-transform active:scale-95 flex items-center justify-center gap-3"
          >
            Get Yori Free
          </Link>
        </div>

        <p className="mt-8 text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">
          Available for iOS & Android
        </p>
      </main>

      {/* Featured Destinations Teaser */}
      <div className="mt-12 md:mt-20 flex gap-4 md:gap-8 px-6 overflow-hidden max-w-full justify-center relative z-20 pb-20">
        {/* Japan */}
        <div className="group relative w-28 h-40 md:w-48 md:h-64 bg-[#1A1D23] rounded-2xl shadow-2xl p-2 md:p-3 border border-slate-800 -rotate-6 hover:rotate-0 transition-all duration-500 hover:scale-110 z-10">
          <div className="w-full h-full relative overflow-hidden rounded-lg bg-slate-900">
            <img 
              src="/destinations/japan.png" 
              alt="Japan"
              className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity"
            />
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] md:text-xs text-white font-bold uppercase tracking-widest">Japan</div>
          </div>
        </div>

        {/* Thailand */}
        <div className="group relative w-28 h-40 md:w-48 md:h-64 bg-[#1A1D23] rounded-2xl shadow-2xl p-2 md:p-3 border border-slate-800 rotate-3 hover:rotate-0 transition-all duration-500 hover:scale-110 z-30">
          <div className="w-full h-full relative overflow-hidden rounded-lg bg-slate-900">
            <img 
              src="/destinations/thailand.png" 
              alt="Thailand"
              className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity"
            />
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] md:text-xs text-white font-bold uppercase tracking-widest">Thailand</div>
          </div>
        </div>

        {/* Switzerland */}
        <div className="group relative w-28 h-40 md:w-48 md:h-64 bg-[#1A1D23] rounded-2xl shadow-2xl p-2 md:p-3 border border-slate-800 -rotate-12 hover:rotate-0 transition-all duration-500 hover:scale-110 z-10">
          <div className="w-full h-full relative overflow-hidden rounded-lg bg-slate-900">
            <img 
              src="/destinations/switzerland.png" 
              alt="Switzerland"
              className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity"
            />
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] md:text-xs text-white font-bold uppercase tracking-widest">Switzerland</div>
          </div>
        </div>
      </div>

      <footer className="mt-auto mb-10 text-slate-500 text-sm font-bold tracking-tighter z-10">
        MADE WITH LOVE BY YORI-SAN 🌏
      </footer>
    </div>
  );
}

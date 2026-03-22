export default function Toast({ msg, error }: { msg: string; error: boolean }) {
  return (
    <div className={`fixed bottom-12 left-1/2 -translate-x-1/2 z-[500] px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl border backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300
      ${error
        ? 'bg-destructive/10 border-destructive/30 text-destructive shadow-destructive/10'
        : 'bg-primary/10 border-primary/30 text-primary shadow-primary/10'
      }`}>
      <div className="flex items-center gap-3">
         <span>{error ? '🔸' : '🔹'}</span>
         {msg}
      </div>
    </div>
  );
}

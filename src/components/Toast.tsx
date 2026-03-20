export default function Toast({ msg, error }: { msg: string; error: boolean }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] px-4 py-2 rounded-md text-sm font-mono shadow-lg border transition-all
      ${error
        ? 'bg-[#131619] border-[#f04d4d] text-[#f04d4d]'
        : 'bg-[#131619] border-[#252b32] text-[#e2e8f0]'
      }`}>
      {msg}
    </div>
  );
}

import { useRef } from 'react';
import Modal from './Modal';

export default function JSONUploadModal({
  open,
  onClose,
  clientJsonInput,
  savedProjectId,
  savingClientJson,
  rawJsonUploading,
  hasSavedClientJson,
  onClientJsonInputChange,
  onClientJsonFileSelect,
  onSaveClientJson,
  onRemoveClientJson,
  onRawJsonFileSelect,
}: {
  open: boolean;
  onClose: () => void;
  clientJsonInput: string;
  savedProjectId?: string;
  savingClientJson: boolean;
  rawJsonUploading: boolean;
  hasSavedClientJson: boolean;
  onClientJsonInputChange: (value: string) => void;
  onClientJsonFileSelect: (file: File) => void | Promise<void>;
  onSaveClientJson: () => void | Promise<void>;
  onRemoveClientJson: () => void | Promise<void>;
  onRawJsonFileSelect: (file: File) => void | Promise<void>;
}) {
  const clientFileRef = useRef<HTMLInputElement | null>(null);
  const rawFileRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  return (
    <Modal title="Advanced Protocol Configuration" onClose={onClose} size="lg">
      <div className="space-y-8 p-1">
        <section className="space-y-6 bg-muted/20 border border-border/50 rounded-[2rem] p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Google OAuth Handshake</h4>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                Identity Layer Fallback Initialization
              </p>
            </div>

            {savedProjectId && (
              <div className="px-3 py-1.5 rounded-xl bg-info/10 border border-info/20 text-[10px] font-black uppercase text-info tracking-widest">
                Linked Project: {savedProjectId}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex justify-start">
              <button
                onClick={() => clientFileRef.current?.click()}
                className="kt-btn kt-btn-light h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all"
              >
                Ingest Google JSON file
              </button>
              <input
                ref={clientFileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={async event => {
                  const file = event.target.files?.[0];
                  if (file) await onClientJsonFileSelect(file);
                  event.target.value = '';
                }}
              />
            </div>

            <textarea
              value={clientJsonInput}
              onChange={event => onClientJsonInputChange(event.target.value)}
              rows={6}
              placeholder="Paste the raw OAuth payload here..."
              className="w-full bg-background border border-border/50 rounded-2xl p-5 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all resize-none shadow-inner"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => void onSaveClientJson()}
              disabled={savingClientJson || !clientJsonInput.trim()}
              className="kt-btn kt-btn-primary h-12 px-8 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20 disabled:opacity-40"
            >
              {savingClientJson ? 'Committing...' : 'Commit Protocol JSON'}
            </button>
            {hasSavedClientJson && (
              <button
                onClick={() => void onRemoveClientJson()}
                className="kt-btn kt-btn-light h-12 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                Destroy Stored Identity
              </button>
            )}
          </div>
        </section>

        <section className="bg-muted/10 border border-border/30 rounded-[2rem] p-8 space-y-6">
          <div className="space-y-1">
            <h4 className="text-sm font-black text-foreground uppercase tracking-widest opacity-80">Manual Postmaster Dump</h4>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">
              Raw Data Injection Port (Volatile)
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => rawFileRef.current?.click()}
              disabled={rawJsonUploading}
              className="kt-btn kt-btn-light h-12 px-8 rounded-2xl font-black text-xs uppercase tracking-[0.2em] border-border/50 hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-40"
            >
              {rawJsonUploading ? 'Streaming...' : 'Inject Raw JSON payload'}
            </button>
            <input
              ref={rawFileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async event => {
                const file = event.target.files?.[0];
                if (file) await onRawJsonFileSelect(file);
                event.target.value = '';
              }}
            />
          </div>
        </section>
      </div>
    </Modal>
  );
}

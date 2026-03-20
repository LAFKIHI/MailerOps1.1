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
    <Modal title="Upload JSON (optional)" onClose={onClose} size="lg">
      <div className="space-y-6">
        <section className="space-y-3 rounded-2xl border border-[#252b32] bg-[#11151c] p-4">
          <div>
            <div className="font-['Syne',sans-serif] text-sm font-bold text-[#e2e8f0]">Google OAuth client JSON</div>
            <p className="mt-1 text-[11px] font-mono text-[#738096]">
              Optional fallback when `VITE_GOOGLE_CLIENT_ID` is not already enough for the Gmail/Postmaster auth flow.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => clientFileRef.current?.click()}
              className="rounded-md border border-[#252b32] bg-[#1a1e22] px-3 py-2 text-sm font-mono text-[#9aa5b4] transition-all hover:border-[#4d8ff0] hover:text-[#4d8ff0]"
            >
              Choose Google JSON
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
            {savedProjectId && (
              <span className="text-[10px] font-mono text-[#7d8aa0]">
                Project: <span className="text-[#d4dbe6]">{savedProjectId}</span>
              </span>
            )}
          </div>

          <textarea
            value={clientJsonInput}
            onChange={event => onClientJsonInputChange(event.target.value)}
            rows={8}
            placeholder="Paste or upload the Google OAuth client JSON here"
            className="w-full rounded-md border border-[#252b32] bg-[#0d0f11] px-3 py-2 text-xs font-mono text-[#e2e8f0] outline-none transition-colors focus:border-[#4d8ff0] placeholder:text-[#5a6478]"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void onSaveClientJson()}
              disabled={savingClientJson || !clientJsonInput.trim()}
              className="rounded-md bg-[#4d8ff0] px-4 py-2 text-sm font-bold font-mono text-white transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              {savingClientJson ? 'Saving...' : 'Save Google JSON'}
            </button>
            {hasSavedClientJson && (
              <button
                onClick={() => void onRemoveClientJson()}
                className="rounded-md border border-[#252b32] bg-[#1a1e22] px-3 py-2 text-sm font-mono text-[#9aa5b4] transition-all hover:border-[#f04d4d] hover:text-[#f04d4d]"
              >
                Remove Saved JSON
              </button>
            )}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-[#252b32] bg-[#11151c] p-4">
          <div>
            <div className="font-['Syne',sans-serif] text-sm font-bold text-[#e2e8f0]">Fallback Postmaster raw JSON</div>
            <p className="mt-1 text-[11px] font-mono text-[#738096]">
              Optional import for manually exported Postmaster data. The file is read in memory, then posted to the backend API.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => rawFileRef.current?.click()}
              disabled={rawJsonUploading}
              className="rounded-md border border-[#252b32] bg-[#1a1e22] px-3 py-2 text-sm font-mono text-[#9aa5b4] transition-all hover:border-[#4df0a0] hover:text-[#4df0a0] disabled:opacity-40"
            >
              {rawJsonUploading ? 'Uploading...' : 'Upload raw JSON'}
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

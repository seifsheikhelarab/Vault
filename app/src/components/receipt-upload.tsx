import { useCallback, useRef, useState, useEffect } from 'react';
import type { DragEvent } from 'react';
import { useUploadReceipt } from '../lib/hooks';

interface ReceiptUploadProps {
    value: string | undefined;
    onChange: (url: string | undefined) => void;
}

export function ReceiptUpload({ value, onChange }: ReceiptUploadProps) {
    const [dragging, setDragging] = useState(false);
    const [preview, setPreview] = useState<string | undefined>(value);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const upload = useUploadReceipt();

    // Keep preview in sync with external value (handles edit-mode pre-fill)
    useEffect(() => {
        setPreview(value);
    }, [value]);

    const showError = useCallback((msg: string) => {
        setError(msg);
        if (errorTimer.current) clearTimeout(errorTimer.current);
        errorTimer.current = setTimeout(() => setError(null), 3000);
    }, []);

    const handleFile = useCallback(
        async (file: File) => {
            if (upload.isPending) return;
            if (!file.type.startsWith('image/')) {
                showError('Please select an image file (PNG, JPG)');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                showError('File too large. Maximum size is 10MB');
                return;
            }

            setError(null);
            const objectUrl = URL.createObjectURL(file);
            setPreview(objectUrl);

            try {
                const { url } = await upload.mutateAsync(file);
                onChange(url);
                setPreview(url);
            } catch (err) {
                showError(err instanceof Error ? err.message : 'Upload failed');
                setPreview(value);
            } finally {
                URL.revokeObjectURL(objectUrl);
            }
        },
        [onChange, showError, upload, value]
    );

    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (upload.isPending) return;
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
        },
        [handleFile, upload.isPending]
    );

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            if (inputRef.current) inputRef.current.value = '';
        },
        [handleFile]
    );

    const handleRemove = useCallback(() => {
        setPreview(undefined);
        onChange(undefined);
        if (inputRef.current) inputRef.current.value = '';
    }, [onChange]);

    if (preview) {
        return (
            <div className="relative rounded-[10px] overflow-hidden border border-border-light group">
                <img
                    src={preview}
                    alt="Receipt preview"
                    className="w-full h-40 object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                    <button
                        type="button"
                        onClick={handleRemove}
                        disabled={upload.isPending}
                        data-cuelume-press
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 px-4 py-2 bg-error text-white text-xs font-semibold rounded-[8px] hover:bg-error/80 active:scale-[0.97] disabled:opacity-50"
                    >
                        Remove
                    </button>
                </div>
                {upload.isPending && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                )}
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-[10px] font-medium rounded-[4px] backdrop-blur-sm">
                    Receipt attached
                </div>
            </div>
        );
    }

    return (
        <div>
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !upload.isPending && inputRef.current?.click()}
                className={`relative rounded-[10px] border-2 border-dashed transition-all duration-200 p-6 text-center ${
                    upload.isPending ? 'cursor-not-allowed' : 'cursor-pointer'
                } ${
                    dragging
                        ? 'border-coral bg-coral-light/30'
                        : error
                          ? 'border-error bg-error/5'
                          : 'border-border-light hover:border-coral-light hover:bg-cream/30'
                }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleInputChange}
                    disabled={upload.isPending}
                    className="hidden"
                />
                <div className="flex flex-col items-center gap-2">
                    <div
                        className={`w-10 h-10 rounded-[10px] flex items-center justify-center transition-colors duration-200 ${
                            dragging
                                ? 'bg-coral/20 text-coral'
                                : error
                                  ? 'bg-error/10 text-error'
                                  : 'bg-cream text-text-tertiary'
                        }`}
                    >
                        {upload.isPending ? (
                            <div className="w-5 h-5 border-2 border-text-tertiary/30 border-t-text-tertiary rounded-full animate-spin" />
                        ) : (
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-text-secondary">
                            {dragging
                                ? 'Drop receipt here'
                                : upload.isPending
                                  ? 'Uploading receipt...'
                                  : 'Add receipt'}
                        </p>
                        <p className="text-xs text-text-tertiary mt-0.5">
                            Drag & drop or click to browse
                        </p>
                    </div>
                    <p className="text-[10px] text-text-tertiary">
                        PNG, JPG · Max 10MB
                    </p>
                </div>
            </div>
            {error && (
                <p className="mt-1.5 text-xs text-error font-medium animate-pulse">
                    {error}
                </p>
            )}
        </div>
    );
}

'use client';

import React, { useState, useRef } from 'react';

interface ImageUploadZoneProps {
  projectId: string;
  onUploadSuccess: () => void;
  maxFilesPerDay?: number;
}

export function ImageUploadZone({
  projectId,
  onUploadSuccess,
  maxFilesPerDay = 20,
}: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);

    // Validate size (10 MB max)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 10 MB limit.`);
      return;
    }

    // Validate type
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrorMessage('Unsupported file format. Please select JPEG, PNG, or WebP.');
      return;
    }

    try {
      setUploading(true);
      setProgress(`Uploading ${file.name}...`);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/v1/projects/${projectId}/images`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setErrorMessage(`Rate limit reached: ${data.error || 'Daily upload limit reached (20 uploads/day)'}`);
        } else if (res.status === 409) {
          setErrorMessage('Cannot upload to an archived project.');
        } else {
          setErrorMessage(data.error || 'Upload failed. Please try again.');
        }
        return;
      }

      setProgress('Uploaded! Processing with Gemini Vision...');
      setTimeout(() => {
        setProgress(null);
        onUploadSuccess();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Property Photos</h3>
          <p className="text-xs text-zinc-500">
            Upload clear exterior or interior photos for AI feature detection (max 10 MB, up to {maxFilesPerDay}/day).
          </p>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />

        <svg
          className="w-10 h-10 text-zinc-400 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>

        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{progress}</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Drag & drop photo here, or <span className="text-indigo-600 dark:text-indigo-400 underline">browse</span>
            </p>
            <p className="text-xs text-zinc-400 mt-1">JPEG, PNG, or WebP up to 10 MB</p>
          </>
        )}
      </div>

      {errorMessage && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-xs text-red-600 dark:text-red-400">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

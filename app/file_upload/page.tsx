'use client';

import {
  MultiFileDropzone,
  type FileState,
} from '@/components/MultiFileDropzone';
import { useEdgeStore } from '@/lib/edgestore';
import { useState } from 'react';

export default function MultiFileDropzoneUsage() {
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const { edgestore } = useEdgeStore();

  // Remove the AssemblyAI client from here - it's now in the API route

  function updateFileProgress(key: string, progress: FileState['progress']) {
    setFileStates((fileStates) => {
      const newFileStates = structuredClone(fileStates);
      const fileState = newFileStates.find(
        (fileState) => fileState.key === key,
      );
      if (fileState) {
        fileState.progress = progress;
      }
      return newFileStates;
    });
  }

  function downloadAsTxt(content: string, fileName: string) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.[^/.]+$/, '_transcription.txt');
    a.click();
    URL.revokeObjectURL(url);
  }

  // New function that calls our API route instead of AssemblyAI directly
  async function transcribeFile(fileUrl: string, fileName: string): Promise<string | null> {
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileUrl: fileUrl,
          options: {
            speakerLabels: true,
            punctuate: true,
            languageDetection: true,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();

      if (data.success && data.transcription) {
        // Auto-download the transcription
        downloadAsTxt(data.transcription, fileName);
        console.log('Transcription success:', data.transcription);
        return data.transcription;
      } else {
        throw new Error('No transcription text received');
      }
    } catch (err) {
      console.error('Error during transcription:', err);
      return null;
    }
  }

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <div>
          <h1 className="text-2xl font-bold mb-4">Audio to Text Transcription</h1>
          
          <MultiFileDropzone
            value={fileStates}
            dropzoneOptions={{
              maxFiles: 5,
              maxSize: 50 * 1024 * 1024, // 50MB limit
              accept: {
                'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.flac'],
                'video/*': ['.mp4', '.mov', '.avi']
              }
            }}
            onChange={(files) => {
              setFileStates(files);
            }}
            onFilesAdded={async (addedFiles) => {
              setFileStates([...fileStates, ...addedFiles]);
              
              await Promise.all(
                addedFiles.map(async (addedFileState) => {
                  try {
                    // Step 1: Upload to EdgeStore
                    const res = await edgestore.publicFiles.upload({
                      file: addedFileState.file,
                      onProgressChange: async (progress) => {
                        updateFileProgress(addedFileState.key, progress);
                        if (progress === 100) {
                          await new Promise((resolve) => setTimeout(resolve, 1000));
                          updateFileProgress(addedFileState.key, 'COMPLETE');
                        }
                      },
                    });

                    const fileUrl = res.url;
                    
                    if (fileUrl) {
                      // Step 2: Call our API to transcribe
                      updateFileProgress(addedFileState.key, 'PENDING'); // Show transcribing state
                      const transcription = await transcribeFile(fileUrl, addedFileState.file.name);

                      if (transcription) {
                        console.log('Transcription completed successfully');
                        updateFileProgress(addedFileState.key, 'COMPLETE');
                      } else {
                        updateFileProgress(addedFileState.key, 'ERROR');
                      }
                    } else {
                      console.error('Upload did not return a file URL.');
                      updateFileProgress(addedFileState.key, 'ERROR');
                    }

                  } catch (err) {
                    console.error('Upload error:', err);
                    updateFileProgress(addedFileState.key, 'ERROR');
                  }
                }),
              );
            }}
          />
        </div>
      </main>
    </div>
  );
}
'use client';

import {
  MultiFileDropzone,
  type FileState,
} from '@/components/MultiFileDropzone';
import { useEdgeStore } from '@/lib/edgestore';
import { useState } from 'react';
import { AssemblyAI } from 'assemblyai';

export default function MultiFileDropzoneUsage() {
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const { edgestore } = useEdgeStore();
  const client = new AssemblyAI({
    apiKey: 'bf4e34fbf133482b81c060dd5586e744',
  });


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
    // Create a Blob with the transcription content
    const blob = new Blob([content], { type: 'text/plain' });
  
    // Generate a temporary URL for the Blob
    const url = URL.createObjectURL(blob);
  
    // Create an anchor element and trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  
    // Revoke the URL after the download
    URL.revokeObjectURL(url);
  }

  async function transcribeFile(fileUrl: string): Promise<string | null> {
    try {

      const params = { 
        audio: fileUrl, 
        speaker_labels: true,
        punctuate: true,
        language_detection: true };

      console.log('FILE URL:', params);
      const transcript = await client.transcripts.transcribe(params);

      // Handle the possibility of transcript.text being undefined
      if (transcript.text) {
        // Save transcription to a .txt file and trigger download
        downloadAsTxt(transcript.text, 'transcription.txt');

        console.log('Transcription:', transcript.text);
        return transcript.text; // Return the text if available
      } else {
        console.warn('Transcript.text is undefined');
        return null; // Return null if text is undefined
      }
    } catch (err) {
      console.error('Error during transcription:', err);
      return null; // Return null in case of error
    }
  }

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
        <main  className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
            <div>
              <MultiFileDropzone
                value={fileStates}
                onChange={(files) => {
                  setFileStates(files);
                }}
                onFilesAdded={async (addedFiles) => {
                  setFileStates([...fileStates, ...addedFiles]);
                  await Promise.all(
                    addedFiles.map(async (addedFileState) => {
                      try {
                        const res = await edgestore.publicFiles.upload({
                          file: addedFileState.file,
                          onProgressChange: async (progress) => {
                            updateFileProgress(addedFileState.key, progress);
                            if (progress === 100) {
                              // wait 1 second to set it to complete
                              // so that the user can see the progress bar at 100%
                              await new Promise((resolve) => setTimeout(resolve, 1000));
                              updateFileProgress(addedFileState.key, 'COMPLETE');
                            }
                          },
                        });

                        // Extract the file URL from the upload response
                        const fileUrl = res.url; // Assuming res contains `url`

                        if (fileUrl) {
                        // Transcribe the file using AssemblyAI
                        updateFileProgress(addedFileState.key, 'PENDING');
                        const transcription = await transcribeFile(fileUrl);

                        if (transcription) {
                            console.log('Transcription success:', transcription);
                            updateFileProgress(
                            addedFileState.key,
                            'COMPLETE'
                            );
                        } else {
                            updateFileProgress(addedFileState.key, 'ERROR');
                        }
                        } else {
                        console.error('Upload did not return a file URL.');
                        updateFileProgress(addedFileState.key, 'ERROR');
                        }

                        console.log(res);
                      } catch (err) {
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
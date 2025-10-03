'use client';

import { useState, useCallback } from 'react';
import { useEdgeStore } from '@/lib/edgestore';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  FileAudio, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Loader2,
  Play,
  Pause,
  Trash2,
  FileText
} from 'lucide-react';

type UploadState = 'idle' | 'uploading' | 'transcribing' | 'completed' | 'error';

interface AudioFile {
  id: string;
  file: File;
  url?: string;
  transcription?: string;
  state: UploadState;
  progress: number;
  error?: string;
}

export default function AudioTranscriptionApp() {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const { edgestore } = useEdgeStore();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: AudioFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 15),
      file,
      state: 'idle' as UploadState,
      progress: 0,
    }));

    setAudioFiles(prev => [...prev, ...newFiles]);
    
    // Start processing files immediately
    newFiles.forEach(processFile);
  }, []);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'],
      'video/*': ['.mp4', '.mov', '.avi', '.mkv']
    },
    maxSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 5,
  });

  const updateFileState = (id: string, updates: Partial<AudioFile>) => {
    setAudioFiles(prev => 
      prev.map(file => 
        file.id === id ? { ...file, ...updates } : file
      )
    );
  };

  const pollTranscriptionStatus = async (transcriptId: string, audioFileId: string, fileName: string) => {
    const maxAttempts = 60; // Poll for up to 5 minutes (60 * 5 seconds)
    let attempts = 0;

    const poll = async (): Promise<void> => {
      try {
        if (attempts >= maxAttempts) {
          throw new Error('Transcription timeout - please try again');
        }

        const response = await fetch(`/api/transcribe?id=${transcriptId}`);
        const data = await response.json();

        if (data.status === 'completed' && data.transcription) {
          updateFileState(audioFileId, {
            state: 'completed',
            transcription: data.transcription,
          });
          
          // Auto-download transcription
          const blob = new Blob([data.transcription], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${fileName.replace(/\.[^/.]+$/, '')}_transcription.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          return;
        }

        if (data.status === 'error') {
          throw new Error(data.error || 'Transcription failed');
        }

        // Still processing, poll again in 5 seconds
        attempts++;
        setTimeout(() => poll(), 5000);
      } catch (error) {
        updateFileState(audioFileId, {
          state: 'error',
          error: error instanceof Error ? error.message : 'Transcription check failed',
        });
      }
    };

    poll();
  };

  const processFile = async (audioFile: AudioFile) => {
    try {
      // Step 1: Upload to EdgeStore
      updateFileState(audioFile.id, { state: 'uploading' });
      
      const res = await edgestore.publicFiles.upload({
        file: audioFile.file,
        onProgressChange: (progress) => {
          updateFileState(audioFile.id, { progress });
        },
      });

      updateFileState(audioFile.id, { 
        url: res.url, 
        state: 'transcribing',
        progress: 100 
      });

      // Step 2: Submit transcription job
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: res.url,
          options: {
            speakerLabels: true,
            punctuate: true,
            languageDetection: true,
          },
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: Expected JSON but got ${contentType}. Check Vercel logs.`);
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit transcription');
      }

      // Step 3: Poll for results
      console.log('Transcription submitted, ID:', data.transcriptId);
      await pollTranscriptionStatus(data.transcriptId, audioFile.id, audioFile.file.name);

    } catch (error) {
      updateFileState(audioFile.id, {
        state: 'error',
        error: error instanceof Error ? error.message : 'Processing failed',
      });
    }
  };

  const downloadTranscription = (audioFile: AudioFile) => {
    if (!audioFile.transcription) return;
    
    const blob = new Blob([audioFile.transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${audioFile.file.name.replace(/\.[^/.]+$/, '')}_transcription.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeFile = (id: string) => {
    setAudioFiles(prev => prev.filter(file => file.id !== id));
  };

  const getStateIcon = (state: UploadState) => {
    switch (state) {
      case 'uploading':
      case 'transcribing':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileAudio className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStateText = (file: AudioFile) => {
    switch (file.state) {
      case 'uploading':
        return `Uploading... ${file.progress}%`;
      case 'transcribing':
        return 'Transcribing audio... (this may take a few minutes)';
      case 'completed':
        return 'Transcription complete';
      case 'error':
        return file.error || 'Processing failed';
      default:
        return 'Ready to process';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (file: File) => {
    // This would require audio loading to get actual duration
    // For now, we'll show file size instead
    return formatFileSize(file.size);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Audio to Text
              </h1>
            </div>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Transform your audio files into accurate text transcriptions. 
              Simply drag & drop your files and we'll handle the rest.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Upload Area */}
        <div className="mb-8">
          <div
            {...getRootProps()}
            className={`
              relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 cursor-pointer
              ${isDragActive 
                ? 'border-blue-400 bg-blue-50/50 scale-[1.02]' 
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50/50'
              }
            `}
          >
            <input {...getInputProps()} />
            
            <div className="space-y-4">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full transition-colors ${
                isDragActive ? 'bg-blue-100' : 'bg-gray-100'
              }`}>
                <Upload className={`w-8 h-8 ${isDragActive ? 'text-blue-600' : 'text-gray-600'}`} />
              </div>
              
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {isDragActive ? 'Drop your files here!' : 'Upload Audio Files'}
                </h3>
                <p className="text-gray-600 mb-4">
                  Drag & drop your audio files here, or click to browse
                </p>
                <div className="inline-flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <FileAudio className="w-4 h-4" />
                    MP3, WAV, M4A, AAC
                  </span>
                  <span>•</span>
                  <span>Max 100MB per file</span>
                  <span>•</span>
                  <span>Up to 5 files</span>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Errors */}
          {fileRejections.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-800">Upload Error</span>
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                {fileRejections.map(({ file, errors }) => (
                  <li key={file.name}>
                    <strong>{file.name}:</strong> {errors[0]?.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* File List */}
        {audioFiles.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Processing Queue ({audioFiles.length})
            </h2>
            
            <div className="space-y-3">
              {audioFiles.map((audioFile) => (
                <div 
                  key={audioFile.id} 
                  className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      {getStateIcon(audioFile.state)}
                    </div>
                    
                    <div className="flex-grow min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-grow">
                          <h3 className="font-medium text-gray-900 truncate">
                            {audioFile.file.name}
                          </h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span>{formatDuration(audioFile.file)}</span>
                            <span>•</span>
                            <span>{getStateText(audioFile)}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {audioFile.state === 'completed' && audioFile.transcription && (
                            <button
                              onClick={() => downloadTranscription(audioFile)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                          )}
                          
                          <button
                            onClick={() => removeFile(audioFile.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      {(audioFile.state === 'uploading' || audioFile.state === 'transcribing') && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: audioFile.state === 'uploading' 
                                  ? `${audioFile.progress}%` 
                                  : '100%'
                              }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {/* Transcription Preview */}
                      {audioFile.state === 'completed' && audioFile.transcription && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700 line-clamp-3">
                            {audioFile.transcription.substring(0, 200)}
                            {audioFile.transcription.length > 200 && '...'}
                          </p>
                        </div>
                      )}
                      
                      {/* Error Message */}
                      {audioFile.state === 'error' && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-700">
                            {audioFile.error}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {audioFiles.length === 0 && (
          <div className="mt-12 text-center">
            <div className="max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                How it works
              </h3>
              <div className="grid md:grid-cols-3 gap-6 text-sm">
                <div className="flex flex-col items-center p-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">1. Upload</h4>
                  <p className="text-gray-600 text-center">
                    Drag & drop or select your audio files
                  </p>
                </div>
                
                <div className="flex flex-col items-center p-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                    <Loader2 className="w-6 h-6 text-purple-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">2. Process</h4>
                  <p className="text-gray-600 text-center">
                    AI transcribes your audio with high accuracy
                  </p>
                </div>
                
                <div className="flex flex-col items-center p-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                    <Download className="w-6 h-6 text-green-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-2">3. Download</h4>
                  <p className="text-gray-600 text-center">
                    Get your transcription as a text file
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
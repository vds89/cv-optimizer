import { NextRequest, NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';

// This runs on the server side, so environment variables are accessible
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLY_AI_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { fileUrl, options } = await request.json();

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'File URL is required' }, 
        { status: 400 }
      );
    }

    const params = {
      audio: fileUrl,
      speaker_labels: options?.speakerLabels ?? true,
      punctuate: options?.punctuate ?? true,
      language_detection: options?.languageDetection ?? true,
      // Add more options as needed
      format_text: true,
      disfluencies: false,
    };

    console.log('Starting transcription for:', fileUrl);
    
    const transcript = await client.transcripts.transcribe(params);

    if (transcript.status === 'error') {
      console.error('Transcription error:', transcript.error);
      return NextResponse.json(
        { error: 'Transcription failed', details: transcript.error },
        { status: 500 }
      );
    }

    if (!transcript.text) {
      return NextResponse.json(
        { error: 'No transcription text generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transcription: transcript.text,
      confidence: transcript.confidence,
      duration: transcript.audio_duration,
      // Include speaker labels if requested
      ...(options?.speakerLabels && transcript.utterances && {
        speakers: transcript.utterances
      })
    });

  } catch (error) {
    console.error('API transcription error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
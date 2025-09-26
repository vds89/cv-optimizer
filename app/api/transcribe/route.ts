import { NextRequest, NextResponse } from 'next/server';
import { AssemblyAI } from 'assemblyai';

// Initialize AssemblyAI client
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLY_AI_API_KEY!,
});

// POST: Submit transcription job (returns immediately)
export async function POST(request: NextRequest) {
  try {
    // Check if API key exists
    if (!process.env.ASSEMBLY_AI_API_KEY) {
      console.error('ASSEMBLY_AI_API_KEY is not set');
      return NextResponse.json(
        { error: 'API key not configured. Please set ASSEMBLY_AI_API_KEY in environment variables.' },
        { status: 500 }
      );
    }

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
      format_text: true,
      disfluencies: false,
    };

    console.log('Starting transcription for:', fileUrl);
    
    // Submit transcription job (doesn't wait for completion)
    const transcript = await client.transcripts.submit(params);

    // Return the transcript ID immediately
    return NextResponse.json({
      success: true,
      transcriptId: transcript.id,
      status: transcript.status,
      message: 'Transcription job submitted successfully'
    });

  } catch (error) {
    console.error('API transcription error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to submit transcription',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}

// GET: Check transcription status and get result
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const transcriptId = searchParams.get('id');

    if (!transcriptId) {
      return NextResponse.json(
        { error: 'Transcript ID is required' },
        { status: 400 }
      );
    }

    // Get transcript status
    const transcript = await client.transcripts.get(transcriptId);

    if (transcript.status === 'error') {
      return NextResponse.json(
        { 
          success: false,
          status: 'error',
          error: transcript.error || 'Transcription failed'
        },
        { status: 500 }
      );
    }

    if (transcript.status === 'completed' && transcript.text) {
      return NextResponse.json({
        success: true,
        status: 'completed',
        transcription: transcript.text,
        confidence: transcript.confidence,
        duration: transcript.audio_duration,
      });
    }

    // Still processing
    return NextResponse.json({
      success: true,
      status: transcript.status, // 'queued' or 'processing'
      message: `Transcription is ${transcript.status}...`
    });

  } catch (error) {
    console.error('API status check error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to check transcription status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
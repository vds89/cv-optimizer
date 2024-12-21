import Image from "next/image";
import Link from 'next/link'

export default function Home() {
  return (
    <div>
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <div
          className="hero min-h-screen"
          style={{
            backgroundImage: "url('/Textured Surface with Scratches.jpeg')",
            
            backgroundPosition: 'center'
          }}>
          <div className="hero-overlay bg-opacity-60"></div>
          <div className="hero-content text-neutral-content text-center">
            <div className="max-w-md">
            <h1 className="mb-6 text-5xl font-extrabold text-gray-900 dark:text-white">
                Audio to Text
              </h1>
              <p className="mb-6 text-lg text-gray-600 dark:text-gray-300">
                Transform your audio into text effortlessly. Our fast and accurate transcription service helps you turn audio files into clear, editable text in just a few clicks. Whether you're working on podcasts, meeting notes, or interviews, we’ve got you covered.
              </p>
              <Link href="/file_upload/">
                <button className="btn btn-primary">Get Transcriptions</button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

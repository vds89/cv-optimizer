# Start by making sure the `assemblyai` package is installed.
# If not, you can install it by running the following command:
# pip install -U assemblyai
#
# Note: Some macOS users may need to use `pip3` instead of `pip`.

import assemblyai as aai

# Replace with your API key
aai.settings.api_key = "6cf855536cd54bd485e5645e752d3b31"

# URL of the file to transcribe
FILE_URL = "https://files.edgestore.dev/i8euyy8f4bkkvvpl/publicFiles/_public/c24695ab-aea3-40e0-9e85-8b3f677c8be2.mp3"
    

# You can also transcribe a local file by passing in a file path
# FILE_URL = './path/to/file.mp3'

transcriber = aai.Transcriber()
transcript = transcriber.transcribe(FILE_URL)

if transcript.status == aai.TranscriptStatus.error:
    print(transcript.error)
else:
    print(transcript.text)
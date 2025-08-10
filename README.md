# NOVA Inspector

NOVA Inspector is a minimal web app that uses optical character recognition (OCR) and the OpenAI API to classify an ingredients list into the NOVA food processing categories (1–4).

## Features
- Upload an image of an ingredients list and preview it in the browser.
- Downscale images on the client for better OCR performance.
- Extract text using [Tesseract.js](https://tesseract.projectnaptha.com/) with Danish and English language support.
- Send the extracted text to an OpenAI model (default `gpt-4o-mini`) that returns the predicted NOVA category and a short explanation in Danish.
- Simple UI shows only the final NOVA category and explanation.
 
## Setup
1. Deploy the project to [Netlify](https://www.netlify.com/) or run `netlify dev` locally.
2. Configure an environment variable `OPENAI_API_KEY` in Netlify containing your OpenAI API key.
3. Open `index.html` in a browser or serve the folder with any static file server.

## Usage
1. Click **Vælg foto af ingrediensliste** and choose an image file.
2. Press **Process** to run OCR and send the text to the OpenAI API.
3. The predicted NOVA category and explanation appear below the button.


## Notes
- The OpenAI request is proxied through a Netlify serverless function; the API key is never exposed to the browser.
- A network connection and valid OpenAI API key are required.


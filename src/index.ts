import { generateStream, retrieve } from "@genkit-ai/ai";
import { configureGenkit } from "@genkit-ai/core";
import { firebaseAuth } from "@genkit-ai/firebase/auth";
import { onFlow } from "@genkit-ai/firebase/functions";
import { gemini15Pro, textEmbeddingGecko001 } from "@genkit-ai/googleai";
import * as z from "zod";
import { defineFirestoreRetriever, firebase } from "@genkit-ai/firebase";
import { googleAI } from "@genkit-ai/googleai";
import { getFirestore } from "firebase-admin/firestore";
import { defineDotprompt } from '@genkit-ai/dotprompt';
import { dotprompt } from '@genkit-ai/dotprompt';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import dotenv from 'dotenv';
import { generate } from '@genkit-ai/ai';

import { MessageData } from "@genkit-ai/ai/model"

//
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors'
//




dotenv.config();

//
const expressApp = express();
expressApp.use(bodyParser.json());
expressApp.use(cors()); // Enable CORS for all routes

//

// **Firebase configuration**
const firebaseConfig = {
  apiKey: "AIzaSyAN-hCp2IzraiEmUSzdh_kQKvpxMOnLh_g",
  authDomain: "reduzers-chatbot.firebaseapp.com",
  projectId: "reduzers-chatbot",
  storageBucket: "reduzers-chatbot.appspot.com",
  messagingSenderId: "826207285900",
  appId: "1:826207285900:web:841f2a194d398e944d81a9",
  measurementId: "G-2D1GGWWVVS",
};

// Change to path to your Admin .json Credential of firestore
const serviceAccount = require('/Users/shubhampetwal/Desktop/reduzer-rag-chatbot/reduzers-chatbot-firebase-adminsdk-3xqgb-8745d0d3d2.json');

// Initialize Firebase Admin SDK
// const app = admin.initializeApp(firebaseConfig);
const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  ...firebaseConfig,
});

// Get Firestore instance
const firestore = getFirestore(app);

// Configure Genkit with plugins and settings
configureGenkit({
  plugins: [
    dotprompt(),
    firebase(),
    googleAI({ apiVersion: ['v1', 'v1beta'] }),
  ],
  flowStateStore: 'firebase',
  logLevel: 'debug',
  traceStore: 'firebase',
  enableTracingAndMetrics: true,
});

// Define Firestore retriever for Reduzers data
const retrieverRef = defineFirestoreRetriever({
  name: "reduzer",
  firestore,
  collection: "reduzer",  // Collection containing Reduzers data
  contentField: "text",  // Field for product descriptions
  vectorField: "embedding", // Field for embeddings
  embedder: textEmbeddingGecko001, // Embedding model
  distanceMeasure: "COSINE", // Similarity metric
});



const systemPrompt: MessageData = 
  {
    role: 'system', content: [{
      text: `You are a helpful and informative bot which will descriptively answer about reduzer docs and respond according to the user's question using the reference passage included below. \
  Be sure to respond in complete sentences, being comprehensive and including all relevant background information. \
  However, you are talking to a non-technical audience, so be sure to break down complicated concepts and \
  strike a friendly and conversational tone. \
  you can highlight the main points in the repsonse by making it bold or in list format.
  If the passage is irrelevant to the answer, you may ignore it.
  Always add the url in link format at the end of the response provided to you` }]
  }

// export const reduzerGetResponseFlow = onFlow(
//   {
//     name: "reduzerGetResponseFlow",
//     inputSchema: z.string(),
//     outputSchema: z.string(),
//     authPolicy: firebaseAuth((user) => {
//       if (!user.email_verified) {
//         throw new Error("Verified email required to run flow");
//       }
//     }),
//   },
//   async (question) => {
//     const docs = await retrieve({
//       retriever: retrieverRef,
//       query: question,
//       options: { limit: 3 },
//     });
//     // console.log("The docs are --",JSON.stringify(docs))


//     let response = await generate({
//       model: gemini15Pro,
//       prompt: question,
//       context: docs,
//       history,
//     });
//     history = response.toHistory();



//     console.log("The response is", response.request);
//     console.log("The history is ", history)
//     return response.text();
//   }
// );

//

// Define a route for the chatbot

expressApp.post('/talkToDocs', async (req, res) => {
  try {
    const {question="",userHistory=[]} = req.body;
    if (!question) {
      return res.status(400).send('Question is required');
    }
    
    const docs = await retrieve({
      retriever: retrieverRef,
      query: question,
      options: { limit: 3 },
    });

    const {response, stream} = await generateStream({
      model: gemini15Pro,
      prompt: question,
      context: docs,
      history:[systemPrompt,...userHistory],
    });

    for await (const chunk of stream()) {
      const chunkText = chunk.content[0].text
      res.write(chunkText)
    }
    console.log("The history is",userHistory)
    return res.end();
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).send('An error occurred');
  }
});
//

// Export the index flow from another module (merch_embed.ts)
export { embedFlow } from './reduzer_embed';
export { dataExtractionFlow } from './dataExtraction';


// Start the server
const PORT = process.env.PORT || 2000;
expressApp.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const { generateStream, retrieve } = require("@genkit-ai/ai");
const { configureGenkit } = require("@genkit-ai/core");
const { gemini15Pro, textEmbeddingGecko001 } = require("@genkit-ai/googleai");
const { defineFirestoreRetriever, firebase } = require("@genkit-ai/firebase");
const { googleAI } = require("@genkit-ai/googleai");
const { getFirestore } = require("firebase-admin/firestore");
const { dotprompt } = require('@genkit-ai/dotprompt');
const admin = require('firebase-admin');
const dotenv = require('dotenv');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

// Load environment variables from .env file
dotenv.config();
// Set the GOOGLE_APPLICATION_CREDENTIALS environment variable
process.env.GOOGLE_APPLICATION_CREDENTIALS = './firebase.json';

// Initialize Express app and middleware
const expressApp = express();
expressApp.use(bodyParser.json());
expressApp.use(cors());

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

// Path to your Admin .json Credential of Firestore
const serviceAccount = require('./firebase.json');

// Initialize Firebase Admin SDK
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
    googleAI({ apiVersion: ['v1', 'v1beta'],apiKey:process.env.GOOGLE_GENAI_API_KEY }),
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
  collection: "reduzer",
  contentField: "text",
  vectorField: "embedding",
  embedder: textEmbeddingGecko001,
  distanceMeasure: "COSINE",
});

const systemPrompt = {
  role: 'system', content: [{
    text: `You are a helpful and informative bot which will descriptively answer about reduzer docs and respond according to the user's question using the reference passage included below. \
Be sure to respond in complete sentences, being comprehensive and including all relevant background information. \
However, you are talking to a non-technical audience, so be sure to break down complicated concepts and \
strike a friendly and conversational tone. \
you can highlight the main points in the response by making it bold or in list format. \
If the passage is irrelevant to the answer, you may ignore it. \
Always add the url in link format at the end of the response provided to you`
  }]
};

// Define a route for the chatbot
expressApp.post('/talkToDocs', async (req, res) => {
  try {
    const { question = "", userHistory = [] } = req.body;
    if (!question) {
      return res.status(400).send('Question is required');
    }

    const docs = await retrieve({
      retriever: retrieverRef,
      query: question,
      options: { limit: 3 },
    });
    console.log("the docs are",docs)
    const { response, stream } = await generateStream({
      model: gemini15Pro,
      prompt: question,
      context: docs,
      history: [systemPrompt, ...userHistory],
    });

    for await (const chunk of stream()) {
      const chunkText = chunk.content[0].text;
      res.write(chunkText);
    }
    console.log("The history is", userHistory);
    return res.end();
  } catch (error) {
    console.error('The Error is:', error);
    return res.status(500).send('An error occurred');
  }
});

// // Export the index flow from another module (merch_embed.ts)
// const { embedFlow } = require('./reduzer_embed');
// const { dataExtractionFlow } = require('./dataExtraction');

// module.exports = { embedFlow, dataExtractionFlow };

// Start the server
const PORT = process.env.PORT || 2000;
expressApp.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});




// const express = require('express');
// const { configureGenkit } = require("@genkit-ai/core");
// const { embed } = require("@genkit-ai/ai/embedder");
// const { textEmbeddingGecko001, googleAI } = require("@genkit-ai/googleai");
// const { FieldValue, getFirestore } = require("firebase-admin/firestore");
// const { chunk } = require("llm-chunk");
// const z = require("zod");
// const { readFile } = require("fs/promises");
// const path = require("path");
// const admin = require('firebase-admin');
// const dotenv = require('dotenv');


// const app = express();
// const port = 3000;
// dotenv.config();

// // Configuration for embedding and indexing
// const indexConfig = {
//   collection: "reduzer",  // Firestore collection to store the data
//   contentField: "text",   // Field name for the text content
//   urlField: "url",        // Field name for the URL
//   vectorField: "embedding", // Field name for the embedding vector
//   embedder: textEmbeddingGecko001, // Embedder model to use
// };

// // Configure Genkit with Google AI plugin
// // configureGenkit({
// //   plugins: [googleAI({ apiVersion: ['v1', 'v1beta'],apiKey:process.env.GOOGLE_GENAI_API_KEY })],
// //   enableTracingAndMetrics: false,
// // });

// // Change to path to your Admin .json Credential of firestore
// const serviceAccount = require('/Users/shubhampetwal/Desktop/reduzer-rag-chatbot/reduzers-chatbot-firebase-adminsdk-3xqgb-8745d0d3d2.json');

// // **Firebase configuration**
// const firebaseConfig = {
//   apiKey: "AIzaSyAN-hCp2IzraiEmUSzdh_kQKvpxMOnLh_g",
//   authDomain: "reduzers-chatbot.firebaseapp.com",
//   projectId: "reduzers-chatbot",
//   storageBucket: "reduzers-chatbot.appspot.com",
//   messagingSenderId: "826207285900",
//   appId: "1:826207285900:web:841f2a194d398e944d81a9",
//   measurementId: "G-2D1GGWWVVS",
// };
// // Initialize Firebase Admin SDK
// // const app = admin.initializeApp(firebaseConfig);
// const fireStoreApp = admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   ...firebaseConfig,
// });

// // Initialize Firestore instance
// const firestore = getFirestore(fireStoreApp);

// // Endpoint to process embedding and indexing
// app.get('/process', async (req, res) => {
//   try {
//     // Read JSON data from file 
//     const filePath = path.resolve('/Users/shubhampetwal/Desktop/reduzer-rag-chatbot/docs/reduzer.json');
//     const jsonData = await extractJSON(filePath);

//     // Process each item in the JSON data
//     for (const item of jsonData) {
//       const { url, markdown } = item;
      
//       // Check for the presence of the URL in Firestore and delete documents if found
//       await checkAndDeleteURL(url);
      
//       // Split markdown into chunks using 'sentence' as delimiter
//       const chunks = await chunk(markdown, { minLength: 2000, splitter: 'sentence' });
      
//       // Index chunks into Firestore
//       await indexToFirestore(chunks, url);
//     }

//     res.status(200).send('Processing completed successfully');
//   } catch (error) {
//     console.error('Error processing:', error);
//     res.status(500).send('Error processing');
//   }
// });

// // Function to check for the presence of a URL in Firestore and delete documents
// async function checkAndDeleteURL(url) {
//   const collectionRef = firestore.collection(indexConfig.collection);
//   const querySnapshot = await collectionRef.where(indexConfig.urlField, "==", url).get();

//   // Delete all documents with the matching URL
//   if (!querySnapshot.empty) {
//     console.log("------------------------------------DELETED--------------------------- url")
//     const batch = firestore.batch();
//     querySnapshot.forEach(doc => {
//       batch.delete(doc.ref);
//     });
//     await batch.commit();
//   }
// }

// // Function to index chunks into Firestore
// async function indexToFirestore(data, url) {
//   for (const text of data) {
//     // Generate embedding for the text chunk
//     const embedding = await embed({
//       embedder: indexConfig.embedder,
//       content: text,
//     });

//     // Add the text, URL, and embedding to Firestore
//     await firestore.collection(indexConfig.collection).add({
//       [indexConfig.vectorField]: FieldValue.vector(embedding),
//       [indexConfig.contentField]: text,
//       [indexConfig.urlField]: url,
//     });
//   }
// }

// // Function to read JSON content from a file
// async function extractJSON(filePath) {
//   const f = path.resolve(filePath);
//   const data = await readFile(f, 'utf-8');
//   return JSON.parse(data);
// }

// // Start the Express server
// app.listen(port, () => {
//   console.log(`Server is running on http://localhost:${port}`);
// });

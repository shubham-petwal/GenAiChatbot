import { configureGenkit } from "@genkit-ai/core";
import { embed } from "@genkit-ai/ai/embedder";
import { defineFlow, run } from "@genkit-ai/flow";
import { textEmbeddingGecko001, googleAI } from "@genkit-ai/googleai";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { chunk } from "llm-chunk";
import * as z from "zod";
import { readFile } from "fs/promises";
import path from "path";

// Configuration for indexing process
const indexConfig = {
  collection: "reduzer",  // Firestore collection to store the data
  contentField: "text",   // Field name for the text content
  urlField: "url",        // Field name for the URL
  vectorField: "embedding", // Field name for the embedding vector
  embedder: textEmbeddingGecko001, // Embedder model to use
};

// Configure Genkit with Google AI plugin
configureGenkit({
  plugins: [googleAI({ apiVersion: ['v1', 'v1beta'] })],
  enableTracingAndMetrics: false,
});

// Initialize Firestore instance
const firestore = getFirestore();

// Define the data processing flow
export const embedFlow = defineFlow(
  {
    name: "embedFlow", // Name of the flow
    inputSchema: z.void(), // No input is expected
    outputSchema: z.void(), // No output is returned 
  },
  async () => {
    console.log("Have reached to embed flow");
    
    // 1. Read JSON data from file 
    // Change the path to your Data file
    const filePath = path.resolve('/Users/shubhampetwal/Desktop/reduzer-rag-chatbot/docs/reduzer.json');
    const jsonData = await run("extract-json", () => extractJSON(filePath));
       
    
    // 2. Process each item in the JSON data
    for (const item of jsonData) {
      const { url, markdown } = item;
      
      // 3. Check for the presence of the URL in Firestore and delete documents if found
      await run("check-and-delete", async () => checkAndDeleteURL(url));
      
      // 4. Split markdown into chunks using 'sentence' as delimiter
      const chunks = await run("chunk-it", async () => chunk(markdown, { minLength: 2000, splitter: 'sentence' }));
      
      // 5. Index chunks into Firestore
      await run("index-chunks", async () => indexToFirestore(chunks, url));
    }
  }
);

// Function to check for the presence of a URL in Firestore and delete documents
async function checkAndDeleteURL(url: string) {
  const collectionRef = firestore.collection(indexConfig.collection);
  const querySnapshot = await collectionRef.where(indexConfig.urlField, "==", url).get();

  // Delete all documents with the matching URL
  if (!querySnapshot.empty) {
    console.log("------------------------------------DELETED--------------------------- url")
    const batch = firestore.batch();
    querySnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}

// Function to index chunks into Firestore
async function indexToFirestore(data: string[], url: string) {
  for (const text of data) {
    // Generate embedding for the text chunk
    const embedding = await embed({
      embedder: indexConfig.embedder,
      content: text,
    });

    // Add the text, URL, and embedding to Firestore
    await firestore.collection(indexConfig.collection).add({
      [indexConfig.vectorField]: FieldValue.vector(embedding),
      [indexConfig.contentField]: text,
      [indexConfig.urlField]: url,
    });
  }
}

// Function to read JSON content from a file
async function extractJSON(filePath: string) {
  const f = path.resolve(filePath);
  const data = await readFile(f, 'utf-8');
  return JSON.parse(data);
}

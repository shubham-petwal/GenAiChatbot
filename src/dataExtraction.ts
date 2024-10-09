import axios from 'axios';
import cheerio from 'cheerio';
import path from 'path';
import fs from 'fs/promises';
import { defineFlow } from "@genkit-ai/flow";
import { z } from 'zod';

// Helper function to fetch HTML content
const fetchHtml = async (url: string): Promise<string | null> => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch URL: ${url}`, error);
    return null;
  }
};

// Function to convert HTML to Markdown
const convertHtmlToMarkdown = (html: string, baseUrl: string, url: string): string => {
  const $ = cheerio.load(html);

  // Remove unwanted elements and get clean text content
  const cleanHtml = $('.main').html() || 'Content not found';
  const textContent = cheerio.load(cleanHtml).text();


  // Add title and source URL
  const pageTitle = $('title').text() || 'No title found';
  const markdown = `Title: ${pageTitle}\n\nSource URL: ${url}\n\nMarkdown Content:\n${textContent}`;

  return markdown;
};

//Check if output directory exists
async function ensureDirectoryExists(directoryPath: string): Promise<void> {
  try {
    await fs.access(directoryPath);
  } catch (error: any) {  // Use `any` to handle the error object
    if (error.code === 'ENOENT') {
      await fs.mkdir(directoryPath, { recursive: true });
      console.log(`Directory ${directoryPath} created`);
    } else {
      throw error;
    }
  }
}

// Define base URL and URLs to fetch
const baseUrl = 'https://docs.reduzer.com/en';
const urls = [
  "about/what-is-reduzer.html",
  "about/what-reduzer-can-do.html",
  "about/carbon-footprint-basics.html",
  "basics/getting-started.html",
  "basics/navigation-in-reduzer.html",
  "basics/create-your-first-project.html",
  "basics/results-and-reports.html",
  "basics/sharing-projects.html",
  "features/overview-of-features.html",
  "features/projects.html",
  "features/libraries.html",
  "features/schemes-+-LCA-calculation.html",
  "features/materials.html",
  "features/energy.html",
  "features/travel.html",
  "features/costs.html",
  "features/templates.html",
  "features/benchmarks.html",
  "features/results.html",
  "features/reports.html",
  "features/design-parameters.html",
  "detailed-documentation/calculations-details.html"
];

// Define the data extraction flow
export const dataExtractionFlow = defineFlow(
  {
    name: "dataExtractionFlow", // Name of the flow
    inputSchema: z.void(), // No input is expected
    outputSchema: z.void(), // No output is returned 
  },
  async () => {
    console.log("Starting data extraction flow");
    const data = [];
    for (const url of urls) {
      const fetchUrl = `${baseUrl}/${url}`;
      const html = await fetchHtml(fetchUrl);
      if (html) {
        const markdown = convertHtmlToMarkdown(html, baseUrl, fetchUrl);
        data.push({ url: fetchUrl, markdown });
        console.log(`Processed ${url}`);
      }
    }
        // Ensure the directory exists before writing the file
        const directoryPath = path.resolve(__dirname, '../extractedData');
        await ensureDirectoryExists(directoryPath);
    
        const filePath = path.join(directoryPath, 'extractedData.json');
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        console.log("Data extraction completed");
  }
);

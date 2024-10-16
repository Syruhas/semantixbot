async function handler(req: Request): Promise<Response> {
    try {
      const wordToFind = "chien";
  
      // Handle GET request (for browser)
      if (req.method === "GET") {
        const url = new URL(req.url);
        const guess = url.searchParams.get("text");
  
        if (!guess) {
          return new Response("Missing query parameter: text", { status: 400 });
        }
  
        const similarityResult = await similarity(guess, wordToFind);
        console.log(
          `Tried with word ${guess}, similarity is ${similarityResult}, word to find is ${wordToFind}`
        );
  
        const responseContent = `
          <html>
            <body>
              <h1>Guess: ${guess}</h1>
              <h1>WordToFind: ${wordToFind}</h1>
              <p>Similarity score: ${similarityResult}</p>
              <p>${responseBuilder(guess, similarityResult)}</p>
            </body>
          </html>`;
        
        return new Response(responseContent, {
          headers: { "Content-Type": "text/html" },
        });
      }
  
      // If method is not GET or POST
      return new Response("Method Not Allowed", { status: 405 });
    } catch (e) {
      console.error(e);
      return new Response(`An error occurred: ${e.message}`, { status: 500 });
    }
  }
  
  
  const extractGuess = async (req: Request): Promise<string> => {
    const contentType = req.headers.get("content-type");
    let guess: string | undefined;
  
    if (contentType && contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      guess = formData.get("text")?.toString();
    } else if (contentType && contentType.includes("application/json")) {
      const jsonData = await req.json();
      guess = jsonData.text;
    } else {
      throw new Error("Unsupported content type");
    }
  
    if (!guess) {
      throw new Error("Guess is empty or null");
    }
    return guess;
  };
  
  const responseBuilder = (word: string, similarity: number): string => {
    if (similarity === 1) {
      return `Well played! The word was ${word}.`;
    } else if (similarity > 0.5) {
      return `${word} is very close to the word, score: ${similarity}`;
    } else {
      return `${word} is quite far from the word, score: ${similarity}`;
    }
  };
  
  const similarity = async (word1: string, word2: string): Promise<number> => {
    const body = {
      word1: word1,
      word2: word2,
    };
    
    console.log("Request body:", body);
  
    const similarityResponse = await fetch(
      "http://word2vec.nicolasfley.fr/similarity",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    
    // Check if the response status is OK (200 range)
    if (!similarityResponse.ok) {
      // Handle non-JSON or error responses
      const errorText = await similarityResponse.text();  // Get the raw response body as text
      console.error("Word2Vec API error:", errorText);    // Log the error for debugging
      throw new Error(`Word2Vec API error: ${similarityResponse.status} ${similarityResponse.statusText}`);
    }
  
    const contentType = similarityResponse.headers.get("content-type");
    
    // Check if the response is JSON
    if (contentType && contentType.includes("application/json")) {
      const similarityResponseJson = await similarityResponse.json();
      console.log("Similarity response JSON:", similarityResponseJson);
      
      // Ensure the result key exists and is a valid number
      if (similarityResponseJson && typeof similarityResponseJson.result === 'number') {
        return Number(similarityResponseJson.result);
      } else {
        throw new Error("Unexpected response format from Word2Vec API");
      }
    } else {
      // If the content-type is not JSON, log the response and throw an error
      const textResponse = await similarityResponse.text();
      console.error("Unexpected response type:", textResponse);
      throw new Error("Word2Vec API returned non-JSON response");
    }
  };
  
  Deno.serve(handler);
async function handler(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url);
      const wordToFind = "chien";
  
      // Extract the query parameter "text" from the URL
      const guess = url.searchParams.get("text");
      
      if (!guess) {
        return new Response("Missing query parameter: text", { status: 400 });
      }
  
      // Call the similarity function with the guess
      const similarityResult = await similarity(guess, wordToFind);
      console.log(
        `Tried with word ${guess}, similarity is ${similarityResult}, word to find is ${wordToFind}`
      );
  
      // Return the HTML response
      const responseContent = `
        <html>
          <body>
            <h1>Guess: ${guess}</h1>
            <p>Similarity score: ${similarityResult}</p>
            <p>${responseBuilder(guess, similarityResult)}</p>
          </body>
        </html>`;
      
      return new Response(responseContent, {
        headers: { "Content-Type": "text/html" },
      });
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
  
  const similarity = async (wword1: string, wword2: string): Promise<number> => {
    const body = {
      word1: wword1,
      word2: wword2,
    };
    console.log("body", body);
    const similarityResponse = await fetch(
      "http://word2vec.nicolasfley.fr/similarity",
      {
        method:"POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    console.log("similarityResponse", similarityResponse);
    const similarityResponseJson = await similarityResponse.json();
    console.log("similarityValue", similarityResponseJson);
    return Number(similarityResponseJson.simscore);
  };
  
  Deno.serve(handler);
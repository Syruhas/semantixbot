const sessions = new Map<string, { wordToFind: string, category: string }>();

async function handler(req: Request): Promise<Response> {
  const sessionId = req.headers.get("cookie") || crypto.randomUUID();
  let sessionData = sessions.get(sessionId);
  
  // Fetch random word and category if not in session
  if (!sessionData) {
    sessionData = await fetchRandomWord();
    sessions.set(sessionId, sessionData);
  }

  let guess = "";
  let similarityResult = 0;
  let errorMessage = "";
  let showHint = false;
  let progressBarValue = 0;

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      guess = url.searchParams.get("text") || "";

      if (url.searchParams.has("hint")) {
        showHint = true;
      }

      if (!guess) {
        throw new Error("Please enter a valid word");
      }

      // Calculate similarity score
      similarityResult = await similarity(guess, sessionData.wordToFind);
      progressBarValue = similarityResult;  // Set progress bar based on similarity
    } else {
      throw new Error("Method Not Allowed");
    }
  } catch (e) {
    // Handle errors
    console.error(e.message);
    errorMessage = e.message;  // Capture the error message
  }

  // Generate the HTML response
  const responseContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; }
          h1 { color: #4CAF50; }
          input { padding: 5px; }
          button { padding: 5px 10px; margin: 5px; background-color: #4CAF50; color: white; border: none; }
          progress { width: 100%; height: 20px; }
          .error { color: red; }
        </style>
      </head>
      <body>
        <h1>Word Guessing Game</h1>
        <form method="GET">
          <label for="text">Enter your guess:</label>
          <input type="text" id="text" name="text" value="${guess}" />
          <button type="submit">Submit</button>
          <button type="submit" name="hint" value="1">Hint</button>
        </form>
        
        <h2>Guess: ${guess || "N/A"}</h2>
        <h2>Word to find: ???</h2>

        ${showHint ? `<p><strong>Hint:</strong> Category: ${sessionData.category}</p>` : ""}
        ${errorMessage ? `<p class="error">Error: ${errorMessage}</p>` : `
          <p>Similarity score: ${similarityResult}</p>
          <p>${responseBuilder(guess, similarityResult)}</p>
          <progress value="${progressBarValue}" max="1"></progress>`}
      </body>
    </html>`;
  
  return new Response(responseContent, {
    headers: {
      "Content-Type": "text/html",
      "Set-Cookie": `session=${sessionId}`,
    },
  });
}

// Fetch a random word from the API
const fetchRandomWord = async (): Promise<{ wordToFind: string, category: string }> => {
  const response = await fetch("https://trouve-mot.fr/api/random");
  const data = await response.json();
  const wordData = data[0];  // Assuming it's always an array with one object
  return { wordToFind: wordData.name, category: wordData.categorie };
};

const similarity = async (word1: string, word2: string): Promise<number> => {
  const body = { word1: word1, word2: word2 };
  const similarityResponse = await fetch("http://word2vec.nicolasfley.fr/similarity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!similarityResponse.ok) {
    const errorText = await similarityResponse.text();
    throw new Error(`Word2Vec API error: ${similarityResponse.status} ${similarityResponse.statusText}`);
  }

  const similarityResponseJson = await similarityResponse.json();
  if (typeof similarityResponseJson.result === 'number') {
    return similarityResponseJson.result;
  } else {
    throw new Error("Unexpected response format from Word2Vec API");
  }
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

Deno.serve(handler);

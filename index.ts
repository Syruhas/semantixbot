const sessions = new Map<string, { wordToFind: string, category: string }>();

async function handler(req: Request): Promise<Response> {
  let sessionId = req.headers.get("cookie")?.split('=')[1]; // Extract session ID from cookie
  if (!sessionId) {
    // Generate new session if no session ID is found
    sessionId = crypto.randomUUID();
  }

  let sessionData = sessions.get(sessionId);

  // Fetch random word and category if not already present in session
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
        showHint = true; // Display hint (category) when the button is pressed
      }

      if (!guess) {
        throw new Error("Please enter a valid word");
      }

      // Calculate similarity score
      similarityResult = await similarity(guess, sessionData.wordToFind);
      progressBarValue = similarityResult;  // Update progress bar based on similarity
    } else {
      throw new Error("Method Not Allowed");
    }
  } catch (e) {
    // Handle errors (like invalid input or API errors)
    console.error(e.message);
    errorMessage = e.message;
  }

  // Generate the HTML response
  const responseContent = `
    <html>
      <head>
        <style>
          body { font-family: 'Arial', sans-serif; background-color: #f2f2f2; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; }
          h1 { color: #4CAF50; font-size: 2em; margin-bottom: 10px; }
          input[type="text"] { padding: 10px; border: 2px solid #d3d3d3; border-radius: 5px; font-size: 1em; width: 80%; margin-bottom: 20px; }
          button { padding: 10px 20px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; font-size: 1em; cursor: pointer; }
          button:hover { background-color: #45a049; }
          progress { width: 100%; height: 30px; margin-top: 20px; background-color: #e0e0e0; border-radius: 10px; overflow: hidden; }
          progress::-webkit-progress-value { background-color: #4CAF50; }
          progress::-moz-progress-bar { background-color: #4CAF50; }
          .hint { font-size: 1.1em; color: #333; margin-top: 20px; }
          .error { color: red; font-size: 1.2em; margin-top: 10px; }
          .container { background-color: white; padding: 40px; border-radius: 10px; box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1); max-width: 500px; width: 100%; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Word Guessing Game</h1>
          <form method="GET">
            <label for="text">Enter your guess:</label>
            <input type="text" id="text" name="text" value="${guess}" placeholder="Type a word here..." />
            <br />
            <button type="submit">Submit</button>
            <button type="submit" name="hint" value="1">Hint</button>
          </form>
          
          <h2>Guess: ${guess || "N/A"}</h2>

          ${showHint ? `<p class="hint">Hint: Category is <strong>${sessionData.category}</strong></p>` : ""}
          ${errorMessage ? `<p class="error">${errorMessage}</p>` : `
            <p>Similarity score: ${similarityResult}</p>
            <p>${responseBuilder(guess, similarityResult)}</p>
            <progress value="${progressBarValue}" max="1"></progress>`}
        </div>
      </body>
    </html>`;
  
  return new Response(responseContent, {
    headers: {
      "Content-Type": "text/html",
      "Set-Cookie": `session=${sessionId}; Path=/; HttpOnly`, // Set session ID in cookie
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

// Import necessary modules for session management
const sessions = new Map<string, { word: string; history: { guess: string; score: number }[] }>();

// Non-linear transformation function
const Transform = (score: number): number => {
  return (score + 1) / 2; // Maps from [-1, 1] to [0, 1]
};

async function handler(req: Request): Promise<Response> {
  const sessionId = req.headers.get("cookie") || Date.now().toString();
  let session = sessions.get(sessionId);
  
  if (!session) {
    const randomWordResponse = await fetch("https://trouve-mot.fr/api/random");
    const randomWordData = await randomWordResponse.json();
    const wordToFind = randomWordData[0].name; // Get the random word
    session = { word: wordToFind, history: [] };
    sessions.set(sessionId, session);
  }

  const wordToFind = session.word;
  let guess = "";
  let similarityResult = 0;
  let errorMessage = "";

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      guess = url.searchParams.get("text") || "";

      if (!guess) {
        throw new Error("Please enter a valid word");
      }

      // Attempt to get similarity score
      similarityResult = await similarity(guess, wordToFind);
      console.log(`Tried with word ${guess}, similarity is ${similarityResult}, word to find is ${wordToFind}`);

      // Store valid guesses in session history
      session.history.push({ guess, score: similarityResult });
      // Sort history by score in descending order
      session.history.sort((a, b) => b.score - a.score);
    } else {
      throw new Error("Method Not Allowed");
    }
  } catch (e) {
    console.error(e.message);
    errorMessage = e.message;  // Capture the error message to display on the page
  }

  // Generate the HTML response with either the similarity result or an error message
  const progressBars = session.history.map(
    (entry) => {
      const normalizedScore = Transform(entry.score);
      return `<div style="width: 100%; margin: 5px 0;">
        <div style="background-color: #77DD77; width: ${normalizedScore * 100}%; height: 20px; border-radius: 5px;"></div>
        <span>${entry.guess} - Score: ${entry.score}</span>
      </div>`;
    }
  ).join("");

  const responseContent = `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #FAF3E0; /* Light pastel background */
            color: #333;
            text-align: center;
            margin: 0;
            padding: 20px;
          }
          h1, h2 {
            color: #6A0572; /* Pastel purple */
          }
          input[type="text"] {
            padding: 10px;
            margin: 10px 0;
            border-radius: 5px;
            border: 1px solid #6A0572;
          }
          button {
            padding: 10px;
            background-color: #6A0572; /* Pastel purple button */
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
          }
          button:hover {
            background-color: #9B59B6; /* Darker purple on hover */
          }
          p {
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <h1>Word Guessing Game</h1>
        <form method="GET">
          <label for="text">Enter your guess:</label>
          <input type="text" id="text" name="text" value="${guess}" />
          <button type="submit">Submit</button>
        </form>

        <h2>Guess: ${guess || "N/A"}</h2>
        ${errorMessage 
          ? `<p style="color: red;">Error: ${errorMessage}</p>` 
          : `<p>Similarity score: ${similarityResult}</p>
             <p>${responseBuilder(guess, similarityResult)}</p>`
        }

        <h2>Previous Guesses</h2>
        ${progressBars}
      </body>
    </html>`;

  return new Response(responseContent, {
    headers: { "Content-Type": "text/html", "Set-Cookie": sessionId },
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

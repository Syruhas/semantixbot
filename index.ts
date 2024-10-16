async function handler(_req: Request): Promise<Response> {
    try {
      const wordToFind = "chien";
      const guess = await extractGuess(_req);
      const similarityResult = await similarity(guess, wordToFind);
      console.log(
        `Tried with word ${guess}, similarity is ${similarityResult}, word to find is ${wordToFind}`
      );
      return new Response(responseBuilder(guess, similarityResult));
    } catch (e) {
      console.error(e);
      return new Response(`An error occurred: ${e.message}`);
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
      sim1: word1,
      sim2: word2,
      lang: "fr",
      type: "General Word2Vec",
    };
    console.log("body", body);
    const similarityResponse = await fetch(
      "http://nlp.polytechnique.fr/similarityscore",
      {
        method: "GET",
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
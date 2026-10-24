// Categorized word list (assignment: "Categorized words (e.g., animals, objects, actions)").
export const WORD_CATEGORIES = {
  animals: [
    'cat', 'dog', 'elephant', 'giraffe', 'penguin', 'dolphin', 'butterfly', 'snake', 'rabbit', 'monkey',
    'lion', 'tiger', 'kangaroo', 'octopus', 'spider', 'turtle', 'owl', 'shark', 'horse', 'frog',
    'bee', 'crab', 'camel', 'zebra', 'parrot',
  ],
  objects: [
    'umbrella', 'bicycle', 'candle', 'clock', 'scissors', 'telephone', 'guitar', 'key', 'lamp', 'glasses',
    'backpack', 'camera', 'chair', 'door', 'mirror', 'television', 'toothbrush', 'wallet', 'hammer', 'balloon',
    'ladder', 'bottle', 'envelope', 'headphones', 'suitcase',
  ],
  food: [
    'pizza', 'banana', 'hamburger', 'ice cream', 'cake', 'apple', 'watermelon', 'popcorn', 'sandwich', 'cookie',
    'carrot', 'egg', 'cheese', 'donut', 'pancake', 'grapes', 'lemon', 'noodles', 'pineapple', 'taco',
    'broccoli', 'cupcake', 'coffee', 'corn', 'strawberry',
  ],
  actions: [
    'swimming', 'sleeping', 'dancing', 'running', 'singing', 'cooking', 'reading', 'jumping', 'climbing', 'fishing',
    'laughing', 'crying', 'painting', 'skiing', 'driving', 'writing', 'cycling', 'surfing', 'sneezing', 'hugging',
    'waving', 'throwing', 'digging', 'typing', 'yawning',
  ],
  places: [
    'beach', 'castle', 'volcano', 'airport', 'library', 'hospital', 'island', 'bridge', 'lighthouse', 'farm',
    'desert', 'jungle', 'school', 'mountain', 'museum', 'pyramid', 'waterfall', 'stadium', 'tent', 'igloo',
    'rainbow', 'moon', 'rocket', 'train', 'windmill',
  ],
};

const ALL_WORDS = Object.values(WORD_CATEGORIES).flat();

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Returns `count` distinct choices, avoiding words already used this game.
// 'combination' mode glues two words together (e.g. "cat umbrella") - harder to draw!
export function pickWords(count, mode = 'normal', used = new Set()) {
  const available = ALL_WORDS.filter((w) => !used.has(w));
  const pool = available.length >= count * 2 ? available : ALL_WORDS; // recycle if exhausted
  const picks = new Set();
  let guard = 0;
  while (picks.size < count && guard++ < 1000) {
    if (mode === 'combination') {
      const a = randomItem(pool);
      const b = randomItem(pool);
      if (a !== b) picks.add(`${a} ${b}`);
    } else {
      picks.add(randomItem(pool));
    }
  }
  return [...picks];
}

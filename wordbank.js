// A large bank of real, common, whole English words used to build the
// generated curriculum (see build-curriculum.js). Every lesson's word list
// is filtered/derived from this bank, never invented on the fly — so the
// generated curriculum is always genuine English, not gibberish.
//
// Kept as one flat, deduped, lowercase list. build-curriculum.js does all
// the filtering (by allowed letters, length, digraphs, etc).

const COMMON_WORDS = [
  // Home-row-friendly (a is the only home-row vowel) + very short words.
  // Home row (a s d f g h j k l) only spells a handful of real English
  // words — resist the urge to pad with lookalikes ("jak", "dag", "gads"
  // aren't words; "hag"/"jag" are real but obscure/unpleasant for a young
  // learner). A short, genuinely real list that repeats across lessons
  // beats a longer list with fake or unfamiliar entries mixed in.
  'dad', 'had', 'sad', 'add', 'ask', 'all', 'fall', 'gas', 'has', 'half',
  'flag', 'glad', 'salad', 'flask', 'gash', 'lash', 'dash', 'sash', 'hall',
  'halls', 'ash', 'hash', 'gala', 'salsa', 'glass', 'lad', 'sag', 'gag', 'lag',

  // Very common short words (2-4 letters)
  'the', 'a', 'i', 'it', 'is', 'at', 'if', 'of', 'do', 'go', 'to', 'so',
  'up', 'us', 'you', 'day', 'way', 'say', 'play', 'stay', 'may', 'lay',
  'pay', 'ray', 'gray', 'today', 'girl', 'world', 'trade', 'great',
  'quiet', 'little', 'study', 'story', 'light', 'right', 'tight',
  'fight', 'delight', 'spirit', 'guitar', 'require', 'desire', 'during',
  'we', 'he', 'she', 'they', 'and', 'can', 'man', 'ran', 'van', 'box',
  'fox', 'name', 'game', 'same', 'came', 'time', 'some', 'come', 'home',
  'like', 'bike', 'make', 'take', 'lake', 'cake', 'wake', 'dog', 'cat',
  'bird', 'fish', 'tree', 'book', 'look', 'cook', 'moon', 'sun', 'star',
  'sky', 'sea', 'run', 'jump', 'walk', 'talk', 'sing', 'ring', 'king',
  'wing', 'bring', 'spring', 'thing', 'think', 'drink', 'blink', 'pink',

  // Medium common words
  'number', 'zebra', 'exam', 'vibe', 'music', 'magic', 'mixed', 'comic',
  'cabin', 'object', 'subject', 'vacuum', 'exciting', 'amazing',
  'become', 'understand', 'never', 'young', 'much', 'enjoy', 'move',
  'happy', 'funny', 'sunny', 'lucky', 'silly', 'jolly', 'windy',
  'rainy', 'cloudy', 'stormy', 'chilly', 'breezy', 'friend', 'family',
  'garden', 'flower', 'forest', 'jungle', 'desert', 'island', 'ocean',
  'river', 'mountain', 'valley', 'meadow', 'castle', 'bridge', 'tunnel',
  'rocket', 'planet', 'galaxy', 'comet', 'shadow', 'rainbow', 'sunset',
  'sunrise', 'thunder', 'lightning', 'blizzard', 'volcano', 'canyon',
  'penguin', 'dolphin', 'octopus', 'giraffe', 'elephant', 'kangaroo',
  'butterfly', 'dragonfly', 'squirrel', 'raccoon', 'hedgehog', 'peacock',

  // Digraph / blend heavy (th, sh, ch, wh, ee, ea, oo, ou, ai, ph, qu, ou)
  'this', 'that', 'then', 'them', 'these', 'those', 'think', 'thank',
  'three', 'throw', 'throat', 'through', 'thought', 'shape', 'share',
  'shine', 'shout', 'shirt', 'short', 'shore', 'wish', 'fish', 'dish',
  'push', 'brush', 'crash', 'flash', 'fresh', 'chair', 'chase', 'cheer',
  'child', 'choose', 'church', 'lunch', 'punch', 'branch', 'sandwich',
  'when', 'where', 'while', 'white', 'whale', 'wheel', 'sheep', 'sweet',
  'street', 'green', 'queen', 'three', 'tree', 'freeze', 'sneeze',
  'bread', 'dream', 'clean', 'cream', 'ocean', 'reason', 'season',
  'each', 'beach', 'teach', 'peach', 'reach', 'speak', 'break', 'great',
  'moon', 'spoon', 'room', 'broom', 'school', 'cool', 'pool', 'tool',
  'food', 'good', 'wood', 'book', 'look', 'took', 'foot', 'cook',
  'out', 'about', 'shout', 'cloud', 'proud', 'sound', 'round', 'ground',
  'mouth', 'south', 'house', 'mouse', 'count', 'found', 'pound',
  'rain', 'train', 'brain', 'chain', 'paint', 'saint', 'wait', 'trail',
  'phone', 'photo', 'graph', 'alphabet', 'elephant', 'dolphin',
  'quick', 'quiet', 'quilt', 'square', 'squeeze', 'squirrel', 'quiz',

  // Longer / multi-syllable words for the "longer words" level
  'beautiful', 'necessary', 'mountain', 'adventure', 'favorite',
  'different', 'important', 'remember', 'together', 'wonderful',
  'yesterday', 'tomorrow', 'afternoon', 'breakfast', 'vegetable',
  'chocolate', 'dinosaur', 'astronaut', 'telescope', 'microscope',
  'calculator', 'dictionary', 'laboratory', 'temperature', 'personality',
  'imagination', 'information', 'conversation', 'celebration',
  'organization', 'environment', 'opportunity', 'responsibility',
  'independence', 'communication', 'transportation', 'refrigerator',
  'characteristic', 'extraordinary', 'unbelievable', 'uncomfortable',
  'understanding', 'entertainment', 'neighborhood', 'grandmother',
  'grandfather', 'basketball', 'skateboard', 'playground', 'homework',
  'classroom', 'notebook', 'backpack', 'sunflower', 'strawberry',
  'watermelon', 'pineapple', 'butterfly', 'caterpillar', 'thunderstorm',

  // Everyday vocabulary (nouns, verbs, adjectives) for general levels
  'apple', 'orange', 'banana', 'grape', 'lemon', 'peach', 'cherry',
  'carrot', 'potato', 'tomato', 'onion', 'pepper', 'garlic', 'lettuce',
  'chicken', 'turkey', 'rabbit', 'horse', 'sheep', 'goat', 'donkey',
  'monkey', 'tiger', 'lion', 'bear', 'wolf', 'fox', 'deer', 'moose',
  'whale', 'shark', 'turtle', 'lizard', 'snake', 'spider', 'beetle',
  'window', 'kitchen', 'bedroom', 'bathroom', 'hallway', 'staircase',
  'chimney', 'fireplace', 'blanket', 'pillow', 'curtain', 'mirror',
  'candle', 'lantern', 'basket', 'bottle', 'bucket', 'hammer', 'ladder',
  'engine', 'bicycle', 'scooter', 'tractor', 'airplane', 'helicopter',
  'submarine', 'sailboat', 'harbor', 'anchor', 'compass', 'lighthouse',
  'teacher', 'student', 'doctor', 'nurse', 'farmer', 'painter', 'writer',
  'singer', 'dancer', 'builder', 'plumber', 'pilot', 'sailor', 'soldier',
  'scientist', 'engineer', 'musician', 'athlete', 'explorer', 'inventor',
  'morning', 'evening', 'midnight', 'weekend', 'holiday', 'birthday',
  'calendar', 'schedule', 'meeting', 'lesson', 'project', 'library',
  'museum', 'theater', 'stadium', 'airport', 'station', 'market',
  'restaurant', 'hospital', 'university', 'company', 'village', 'city',
  'country', 'nation', 'planet', 'universe', 'weather', 'climate',
  'season', 'winter', 'summer', 'autumn', 'spring', 'holiday', 'journey',
  'voyage', 'mission', 'mystery', 'treasure', 'legend', 'fable',
  'courage', 'kindness', 'honesty', 'patience', 'wisdom', 'freedom',
  'justice', 'harmony', 'balance', 'energy', 'motion', 'gravity',
  'pressure', 'texture', 'pattern', 'rhythm', 'melody', 'harmony',
  'picture', 'sculpture', 'canvas', 'palette', 'costume', 'curtain',

  // Contraction-friendly / apostrophe words for punctuation lessons
  "don't", "can't", "won't", "isn't", "aren't", "wasn't", "weren't",
  "it's", "that's", "he's", "she's", "we're", "they're", "I'm", "I've",
  "you're", "let's", "didn't", "couldn't", "shouldn't", "wouldn't"
];

// Curriculum data for TypeAloud.
// Each lesson only uses words made of letters/keys taught so far (plus space),
// following the same "no letters you haven't learned yet" rule TTRS-style
// touch-typing courses use. Real, whole, phonics-friendly words throughout —
// no random letter drills.

const LESSONS = [
  {
    id: 1,
    title: 'Home Row',
    newKeys: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    description: 'Rest your fingers on a s d f  j k l and keep your eyes on the screen, not your hands.',
    words: [
      'dad', 'sad', 'add', 'ask', 'all', 'fall', 'gas', 'has', 'half',
      'flag', 'glad', 'salad', 'flask', 'alas', 'gash', 'lash', 'dash',
      'hall', 'ash', 'hash'
    ]
  },
  {
    id: 2,
    title: 'Top Row',
    newKeys: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    description: 'Reach up to the row above home row without looking down.',
    words: [
      'the', 'it', 'is', 'at', 'if', 'of', 'do', 'go', 'to', 'so',
      'up', 'us', 'you', 'day', 'way', 'play', 'stay', 'today', 'girl',
      'world', 'great', 'quiet', 'little', 'story', 'light', 'right',
      'fight', 'spirit', 'guitar', 'require'
    ]
  },
  {
    id: 3,
    title: 'Bottom Row',
    newKeys: ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'],
    description: 'The whole alphabet is unlocked now. Curl your fingers down to the bottom row.',
    words: [
      'and', 'can', 'man', 'van', 'box', 'fox', 'name', 'some', 'come',
      'number', 'zebra', 'exam', 'vibe', 'music', 'magic', 'mixed',
      'comic', 'cabin', 'object', 'subject', 'vacuum', 'exciting',
      'amazing', 'become', 'understand', 'never', 'young', 'much',
      'enjoy', 'move'
    ]
  },
  {
    id: 4,
    title: 'Numbers',
    newKeys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    description: 'Reach for the number row while keeping your other fingers anchored.',
    words: [
      '2024', '123', '456', '789', '100', '1st', '2nd', '3rd',
      'room 12', 'page 45', 'chapter 7', 'level 3', 'unit 9',
      '10 cats', '5 dogs', '7 days', '3 pens', '9 lives', '24 hours',
      '60 minutes'
    ]
  },
  {
    id: 5,
    title: 'Capitals & Punctuation',
    newKeys: ['Shift', '.', ',', '!', '?'],
    description: 'Hold Shift with your opposite pinky to capitalize the first letter of a sentence.',
    words: [
      'I am happy.', 'The sun is hot.', 'She has a red hat.',
      'We play all day.', 'This is fun!', 'Can you spell it?',
      'Dogs like to run.', 'Birds can fly high.',
      'I like to read books.', 'It is a sunny day.'
    ]
  },
  {
    id: 6,
    title: 'Mixed Review',
    newKeys: [],
    description: 'Trickier whole words pulled together for extra practice.',
    words: [
      'beautiful', 'necessary', 'mountain', 'adventure', 'favorite',
      'different', 'important', 'remember', 'together', 'wonderful'
    ]
  }
];

// Physical-key -> finger mapping (US QWERTY, standard touch-typing chart).
const FINGER_MAP = {
  '`': 'l-pinky', '1': 'l-pinky', 'q': 'l-pinky', 'a': 'l-pinky', 'z': 'l-pinky',
  '2': 'l-ring', 'w': 'l-ring', 's': 'l-ring', 'x': 'l-ring',
  '3': 'l-middle', 'e': 'l-middle', 'd': 'l-middle', 'c': 'l-middle',
  '4': 'l-index', 'r': 'l-index', 'f': 'l-index', 'v': 'l-index',
  '5': 'l-index', 't': 'l-index', 'g': 'l-index', 'b': 'l-index',
  '6': 'r-index', 'y': 'r-index', 'h': 'r-index', 'n': 'r-index',
  '7': 'r-index', 'u': 'r-index', 'j': 'r-index', 'm': 'r-index',
  '8': 'r-middle', 'i': 'r-middle', 'k': 'r-middle', ',': 'r-middle',
  '9': 'r-ring', 'o': 'r-ring', 'l': 'r-ring', '.': 'r-ring',
  '0': 'r-pinky', 'p': 'r-pinky', ';': 'r-pinky', '/': 'r-pinky',
  '-': 'r-pinky', "'": 'r-pinky', '[': 'r-pinky', ']': 'r-pinky',
  ' ': 'thumb'
};

const FINGER_LABELS = {
  'l-pinky': 'Left pinky', 'l-ring': 'Left ring', 'l-middle': 'Left middle',
  'l-index': 'Left index', 'r-index': 'Right index', 'r-middle': 'Right middle',
  'r-ring': 'Right ring', 'r-pinky': 'Right pinky', 'thumb': 'Thumbs (space)'
};

// Visual keyboard layout, top to bottom.
const KEYBOARD_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/']
];

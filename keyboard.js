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
  '!': 'l-pinky', '?': 'r-pinky', ':': 'r-pinky', '"': 'r-pinky', '(': 'r-ring', ')': 'r-pinky',
  ' ': 'thumb'
};

const FINGER_LABELS = {
  'l-pinky': 'Left pinky', 'l-ring': 'Left ring', 'l-middle': 'Left middle',
  'l-index': 'Left index', 'r-index': 'Right index', 'r-middle': 'Right middle',
  'r-ring': 'Right ring', 'r-pinky': 'Right pinky', 'thumb': 'Thumbs (space)'
};

// Visual keyboard layout, top to bottom. Shift is drawn but not a typed key.
const KEYBOARD_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/']
];

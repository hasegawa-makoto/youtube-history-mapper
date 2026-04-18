import kuromoji from 'kuromoji';
import natural from 'natural';

let tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

const STOP_WORDS = new Set([
  '動画', 'youtube', 'ch', 'チャンネル', 'の', 'に', 'は', 'を', 'が', 'で', 'と',
  'video', 'shorts', 'youtube', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to'
]);

export async function initKuromoji(): Promise<void> {
  if (tokenizer) return;
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    isInitializing = true;
    const dicPath = chrome.runtime.getURL('dict/');
    console.log('Initializing Kuromoji with dict path:', dicPath);

    kuromoji.builder({ dicPath }).build((err, _tokenizer) => {
      isInitializing = false;
      if (err) {
        console.error('Failed to initialize Kuromoji:', err);
        reject(err);
      } else {
        tokenizer = _tokenizer;
        console.log('Kuromoji initialized successfully.');
        resolve();
      }
    });
  });

  return initPromise;
}

export function isJapanese(text: string): boolean {
  // Simple check: if it contains Hiragana, Katakana, or Kanji, consider it Japanese
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

export async function extractKeywords(text: string): Promise<string[]> {
  const keywords = new Set<string>();
  const isJp = isJapanese(text);

  if (isJp) {
    if (!tokenizer) {
      await initKuromoji();
    }
    if (tokenizer) {
      const tokens = tokenizer.tokenize(text);
      for (const token of tokens) {
        // Extract nouns (名詞), ignoring general terms and stops
        if (token.pos === '名詞' && token.pos_detail_1 !== '非自立' && token.pos_detail_1 !== '代名詞' && token.pos_detail_1 !== '数') {
          const word = token.surface_form.toLowerCase();
          if (word.length > 1 && !STOP_WORDS.has(word)) {
            keywords.add(word);
          }
        }
      }
    }
  } else {
    // English parsing using natural
    const engTokenizer = new natural.WordTokenizer();
    const tokens = engTokenizer.tokenize(text);
    if (tokens) {
      for (const token of tokens) {
        const word = token.toLowerCase();
        if (word.length > 2 && !STOP_WORDS.has(word)) {
          keywords.add(natural.PorterStemmer.stem(word));
        }
      }
    }
  }

  return Array.from(keywords);
}

export async function processVideoKeywords(title: string, tags: string[]): Promise<string[]> {
  const textToProcess = `${title} ${tags.join(' ')}`;
  return extractKeywords(textToProcess);
}
